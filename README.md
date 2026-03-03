# SmartShift: Banda (Цех85)

Chrome расширение для автоматизации работы с табелем смен в корпоративной системе Banda (banda.tseh85.ru) для сотрудников сети магазинов Цех85.

## Основной функционал
- ✅ Автоматический перехват Bearer токена из localStorage
- ✅ Отображение расписания смен с точным временем начала/конца
- ✅ Список коллег, работающих в те же смены с расчётом пересечений
- ✅ Отслеживание изменений в расписании (новые/измененные/удаленные смены)
- ✅ Экспорт в iCalendar (.ics) для импорта в Google/Apple Calendar
- ✅ Выбор сотрудника из списка точки
- ✅ Offline mode (кэширование данных)
- ✅ Debounce обновлений (защита от частых запросов)

## Технический стек
- Manifest V3 (Chrome Extension)
- Vanilla JavaScript (без фреймворков)
- Chrome Storage API
- Fetch API для работы с REST API Banda

## API Endpoints
- Personal schedule: `/api/banda/table/personal/show`
- Department schedule: `/api/banda/table/show`
- Authorization: Bearer token from localStorage['tokens-prod']

## Структура файлов
- manifest.json - конфигурация расширения
- background.js - service worker для обработки сообщений
- content.js - извлечение токена и ID из localStorage
- popup.html - интерфейс расширения (420px)
- popup.js - бизнес-логика приложения
- icon.png - иконка расширения

## Хранение данных (chrome.storage.local)
- bearerToken - JWT токен авторизации
- employeeId - ID текущего пользователя
- departmentId - ID точки/департамента (приоритет: 01JWPAN7SFP9E017QN9BRGQZV0)
- snapshots[employeeId][YYYY-MM] - снапшоты расписания для отслеживания изменений
- currentSchedule - текущее расписание
- lastUpdateTime - время последнего обновления

## Текущая версия
1.0.0

## Статус
✅ Работает
🔧 В процессе доработки и багфиксинга
