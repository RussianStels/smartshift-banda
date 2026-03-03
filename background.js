// Background service worker для Manifest V3
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SAVE_TOKEN') {
    chrome.storage.local.set({ 
      bearerToken: request.token,
      tokenTimestamp: Date.now()
    }, () => {
      console.log('✅ Bearer token сохранён');
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.type === 'SAVE_IDS') {
    const dataToSave = {};
    
    // Сохраняем только если данные действительно есть
    if (request.employeeId) {
      dataToSave.employeeId = request.employeeId;
    }
    
    if (request.departmentId) {
      dataToSave.departmentId = request.departmentId;
    }
    
    // Сохраняем списки если переданы
    if (request.employeesList) {
      dataToSave.employeesList = request.employeesList;
    }
    
    if (request.departmentsList) {
      dataToSave.departmentsList = request.departmentsList;
    }
    
    chrome.storage.local.set(dataToSave, () => {
      console.log('✅ ID сохранены:', dataToSave);
      sendResponse({ success: true });
    });
    return true;
  }
});