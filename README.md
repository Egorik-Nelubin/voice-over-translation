# Закадровый перевод видео

Закадровый перевод видео не только в YandexBrowser.
Очень признателен, **[Yandex.Translate](https://translate.yandex.ru/)** & **[sodapng](https://github.com/sodapng)** & **[mynovelhost](https://github.com/mynovelhost)**. Спасиб <3

## Установка расширения:
1. Установите расширение **[Tampermonkey](https://www.tampermonkey.net/)** (Альтернатива для Safari: **[UserScripts](https://apps.apple.com/app/userscripts/id1463298887 )**)
2. **[«Установите Скрипт»](https://raw.githubusercontent.com/ilyhalight/voice-over-translation/master/dist/vot.user.js)**

### Полезные ссылки:
1. Версия для VioletMonkey, FireMonkey, GreaseMonkey, AdGuard, UserScripts и некоторых браузеров: **[Ссылка](https://raw.githubusercontent.com/ilyhalight/voice-over-translation/master/dist/vot-cloudflare.user.js)**
2. Версия для терминала: **[Ссылка](https://github.com/ilyhalight/voice-over-translation/tree/master/vot-cli)**
3. Подробнее о создание воркера для VioletMonkey, FireMonkey, GreaseMonkey, AdGuard, UserScripts: **[Ссылка](https://github.com/mynovelhost/voice-over-translation/)**

## Список поддерживаемых сайтов:
- **[YouTube](https://www.youtube.com)** (Полная поддержка **www.youtube.com/watch**, **www.youtube.com/embed**, **m.youtube.com**. Включая **[YouTube NoCookie](https://www.youtube-nocookie.com/)**)
- **[Invidious (vern.cc)](https://inv.vern.cc)**, **[Invidious (yewtu.be)](https://yewtu.be)** и некоторые другие (Альтернативный фронтенд для YouTube, без привязки к Google Services. Для работы в хромоподобных браузерах необходимо дополнительное **[расширение](https://chrome.google.com/webstore/detail/disable-content-security/ieelmcmcagommplceebfedjlakkhpden/related)**)
- **[Piped (piped.video)](https://piped.video)** и некоторые другие (Альтернативный фронтенд для YouTube, без привязки к Google Services. Для работы в хромоподобных браузерах необходимо дополнительное **[расширение](https://chrome.google.com/webstore/detail/disable-content-security/ieelmcmcagommplceebfedjlakkhpden/related)**)
- **[Twitch](https://www.twitch.tv)** (Поддерживается **www.twitch.tv/videos**, **m.twitch.tv/videos**, **player.twitch.tv**, **clips.twitch.tv**, **www.twitch.tv/NICKNAME/clip/**)
- **[XVideos](https://xvideos.com/)** (Для работы в хромоподобных браузерах необходимо дополнительное **[расширение](https://chrome.google.com/webstore/detail/disable-content-security/ieelmcmcagommplceebfedjlakkhpden/related)**)
- **[PornHub](https://rt.pornhub.com/)**
- **[VK](https://vk.com)** (Поддерживаются **vk.com|ru/video**, **vk.com|ru/video_ext.php**, **vk.com|ru/video-xxxxxxxxx_xxxxxxxxx** и **vk.com|ru/im?z=video-xxxxxxxxx_xxxxxxxxx** (+ другие страницы, на которых видео открывается через z параметр ссылки). Рекомендую использовать только совместно с автопереводом, ибо без него кнопка перевода требует 2-ого нажатия, и звук перевода пропадает при переходе на другое видео. Не знаю как это исправить :с)
- **[Vimeo](https://vimeo.com/)**
- **[9GAG](https://9gag.com/gag/)** (Работает только в открытых видео. В ленте не работает.)
- **[Twitter](https://twitter.com/)** (Работает только в открытых видео. В ленте не работает.)
- **[Facebook*](https://facebook.com/)** (❌ Не работает)
- **[Rutube](https://rutube.ru/)** (Полная поддержка **rutube.ru/video/** и **rutube.ru/play/embed/**)
- **[Bilibili](https://bilibili.com/)** (Поддерживаются **bilibili.com/video/** и **bilibili.com/blackboard/webplayer/embed-old.html**)
- **[Видео Mail.ru](https://my.mail.ru/video)** (Работает только в открытых видео. В ленте не работает.)

## Список функционала:
1. Перевод с одного из доступных языков на русский. Язык определяется автоматически, если языка нету в списке или не удалось его определить, то используется перевод с английского.
2. Перевод с русского на английский язык
3. Автоматический перевод видео при открытие
4. Слайдер для изменения громкости видео
5. Автоматически выставлять громкость видео (как в Яндекс браузере)
6. [YouTube Only] Синхронизация громкости перевода с громкостью видео
7. [YouTube Only] Ограничить перевод русскоязычных видео

## Как собрать расширение?
1. Установите NodeJS 16+
2. Установите зависимости:
```bash
npm i
```
3. Сборка расширения:

   3.0. Все версии сразу:
   ```bash
   npm run build
   ```

   3.1. Все минифицированные версии сразу:
   ```bash
   npm run build:min
   ```

   3.2. Только обычная версии:
   ```bash
   npm run build:default
   ```

   3.3. Только Cloudflare версии:
   ```bash
   npm run build:cloudflare
   ```

   3.2. Только обычная мин. версии:
   ```bash
   npm run build:default-min
   ```

   3.3. Только мин. Cloudflare версии:
   ```bash
   npm run build:cloudflare-min
   ```

## Как задеплоить свой Cloudflare Worker?
Видео инструкция: [**видео от mynovelhost**](https://raw.githubusercontent.com/mynovelhost/voice-over-translation/master/how_to_create_custom_worker.mp4)

Текстовая инструкция:
1. Зарегистрируйтесь в [Cloudflare Dashboard](https://dash.cloudflare.com) и войдите в панель управления
2. В большом левом меню выберите пункт "Workers & Pages"
3. Пройдите регистрацию в "Workers & Pages" выбрав Free тариф
4. Если вы всё сделаете верно, то вас перекинет на страницу, где вы сможете нажать на синию кнопку "Create application"
5. На появившейся странице нажмите синию кнопку "Create worker"
6. Введите желаемое название для поддомена и нажмите синию кнопку "Deploy"
7. Если всё прошло успешно, то у вас будет на выбор две кнопки "Configure worker" и "Edit code", вам нужно выбрать "Edit code"
8. В открывшемся браузерном текстовом редакторе замените все содержимое файла worker.js на содержимое файла [CloudWorker.js](https://github.com/ilyhalight/voice-over-translation/blob/master/package.json)
9. Сохраните код с помощью комбинации Ctrl + S и нажмите на синию кнопку "Save and deploy"
10. Готово, теперь, вам осталось всего лишь поменять в коде "vot.toil-dump.workers.dev" на домен вашего воркера

## Примечание:
1. Рекомендую разрешить автовоспроизведение "аудио и видео", чтобы избежать ошибок при работе расширения
2. Расширение не может переводить видео длиной более 4 часов (ограничение API переводчика)
3. Если не работает кнопка перевода, то попробуйте следующее:
   1. Зайти в инструменты разработчика (F12 или Ctrl+Shift+I)
   2. Перейти в Application (Приложение) P.S. В некоторых браузерах этого пункта нету. В них необходимо сразу перейти в Storage (Хранилище).
   3. Выбрать Storage (Хранилище)
   4. Выбрать IndexedDB
   5. Нажать ЛКМ по строке с надписью VOT (в Firefox нужно нажать ПКМ)
   6. Нажать на Delete Database (Удалить базу данных)
   7. Перезагрузить страницу

## Расширение протестировано в следующих браузерах:
| Статус | Браузер | Версия браузера | Платформа | Расширение
|---|---|---|---|---
| ⠀✅ | Firefox Developer Edition | v106.0b4, 64 bit | Windows | Tampermonkey
| ⠀✅ | Firefox | v105.0.1 | Linux | Tampermonkey
| ⠀✅ | LibreWolf | v100.0.2-1 | Windows | Tampermonkey
| ⠀✅ | Brave | v106.0.5249.91 | Windows | Tampermonkey
| ⠀✅ | MS Edge | v106.0.1370.34 | Windows, Linux | Tampermonkey
| ⠀✅ | Cent Browser | v4.3.9.248, 32 bit | Windows | Tampermonkey
| ⠀✅ | Cent Browser Beta | v5.0.1002.182, 64 bit | Windows | Tampermonkey
| ⠀✅ | Google Chrome | v106.0.5249.91 | Windows, MacOS, Linux | Tampermonkey, Violetmonkey
| ⠀✅ | Opera GX | LVL4 (core: 91.0.4516.36) | Windows | Tampermonkey
| ⠀✅ | Opera | v92.0.4561.43 | Windows | Tampermonkey
| ⠀✅ | Vivaldi | 5.7.2921.63 | Windows, Linux | Tampermonkey
| ⠀❔ | Safari | v15.6.1 | MacOS | Userscripts

## Протестировано в следующих расширениях для юзерскриптов:
| Статус | Браузер | Расширение
|---|---|---
| ⠀✅ | Любой | Tampermonkey
| ⠀[Загрузить](https://raw.githubusercontent.com/ilyhalight/voice-over-translation/master/dist/vot-cloudflare.user.js) | Safari | Userscripts
| ⠀[Загрузить](https://raw.githubusercontent.com/ilyhalight/voice-over-translation/master/dist/vot-cloudflare.user.js) | Любой | Violetmonkey 
| ⠀[Загрузить](https://raw.githubusercontent.com/ilyhalight/voice-over-translation/master/dist/vot-cloudflare.user.js) | Любой | [AdGuard Usercripts](https://kb.adguard.com/en/general/userscripts#supported-apps)
| ⠀[Загрузить](https://raw.githubusercontent.com/ilyhalight/voice-over-translation/master/dist/vot-cloudflare.user.js) | Firefox | Firemonkey
| ⠀[Загрузить](https://raw.githubusercontent.com/ilyhalight/voice-over-translation/master/dist/vot-cloudflare.user.js) | Любой | Greasemonkey

![example btn](https://github.com/ilyhalight/voice-over-translation/blob/master/img/example.jpg "btn")

*: Запрещена на территории РФ