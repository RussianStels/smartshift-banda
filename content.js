(function() {
  'use strict';

  console.log('✅ Banda Extension: Content script loaded');

  function extractTokenFromStorage() {
    try {
      const tokensData = localStorage.getItem('tokens-prod');
      
      if (tokensData) {
        try {
          const parsed = JSON.parse(tokensData);
          let token = null;
          
          if (Array.isArray(parsed)) {
            token = parsed[0];
          } else if (typeof parsed === 'object') {
            token = parsed.access_token || parsed.token || parsed.accessToken;
          } else if (typeof parsed === 'string') {
            token = parsed;
          }
          
          if (token && typeof token === 'string' && token.startsWith('eyJ')) {
            console.log('✅ Токен найден!');
            chrome.runtime.sendMessage({
              type: 'SAVE_TOKEN',
              token: token
            });
            return token;
          }
        } catch (e) {
          console.log('❌ Ошибка парсинга токена:', e);
        }
      }
    } catch (e) {
      console.log('❌ Ошибка чтения localStorage:', e);
    }
    return null;
  }

  function extractIdsFromLocalStorage() {
    try {
      let departmentsList = [];
      let employeeId = null;
      let preferredDepartmentId = null;
      
      // Ищем все департаменты
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        
        if (key.startsWith('department_')) {
          const deptId = key.replace('department_', '');
          const value = localStorage.getItem(key);
          
          try {
            const employees = JSON.parse(value);
            
            if (typeof employees === 'object' && !Array.isArray(employees)) {
              const empArray = Object.values(employees);
              
              if (empArray.length > 0 && empArray[0].match(/^[A-Z0-9]{26}$/)) {
                console.log('🆔 Найден департамент:', deptId, 'сотрудников:', empArray.length);
                
                departmentsList.push({
                  id: deptId,
                  employees: empArray
                });
                
                // Используем департамент с ID 01JWPAN7SFP9E017QN9BRGQZV0 как приоритетный
                if (deptId === '01JWPAN7SFP9E017QN9BRGQZV0') {
                  preferredDepartmentId = deptId;
                  employeeId = empArray[0];
                }
                
                // Если приоритетный не найден, берём первый
                if (!employeeId) {
                  employeeId = empArray[0];
                }
              }
            }
          } catch (e) {}
        }
      }
      
      if (departmentsList.length > 0) {
        // Используем приоритетный департамент или первый в списке
        const selectedDept = departmentsList.find(d => d.id === preferredDepartmentId) || departmentsList[0];
        
        console.log('✅ Выбран департамент:', selectedDept.id);
        
        chrome.runtime.sendMessage({
          type: 'SAVE_IDS',
          employeeId: employeeId,
          departmentId: preferredDepartmentId || selectedDept.id,
          departmentsList: departmentsList,
          employeesList: selectedDept.employees
        });
      }
    } catch (e) {
      console.log('❌ Ошибка извлечения ID:', e);
    }
  }

  // Перехват XHR для извлечения departmentId из запросов
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    return originalXHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    this.addEventListener('readystatechange', function() {
      if (this.readyState === 4 && this._url && this._url.includes('api.banda.tseh85.ru')) {
        try {
          const urlObj = new URL(this._url);
          const employeeId = urlObj.searchParams.get('employeeId');
          const departmentId = urlObj.searchParams.get('departmentId');
          
          if (employeeId || departmentId) {
            console.log('🆔 ID из API запроса:', { employeeId, departmentId });
            chrome.runtime.sendMessage({
              type: 'SAVE_IDS',
              employeeId: employeeId,
              departmentId: departmentId
            });
          }
        } catch (e) {}
      }
    });
    return originalXHRSend.apply(this, arguments);
  };

  // Запускаем извлечение
  setTimeout(() => {
    extractTokenFromStorage();
    extractIdsFromLocalStorage();
  }, 500);

  setTimeout(() => {
    extractTokenFromStorage();
    extractIdsFromLocalStorage();
  }, 2000);

  // Дополнительно: слушаем изменения URL
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log('🔄 URL изменился, проверяем ID...');
      setTimeout(extractIdsFromLocalStorage, 500);
    }
  }).observe(document, {subtree: true, childList: true});

})();