// --- IndexedDB functions start:
const dbVersion = 2; // current db version
const settingsDefault = {
  key: "settings",
  autoTranslate: 0,
  defaultVolume: 100,
  showVideoSlider: 0,
  syncVolume: 0,
  autoSetVolumeYandexStyle: 1,
  dontTranslateRuVideos: 0,
}; // default settings for db v1

function openDB(name) {
  return indexedDB.open(name, dbVersion);
}

async function initDB() {
  return new Promise((resolve, reject) => {
    const openRequest = openDB("VOT");

    openRequest.onerror = () => {
      console.error(
        `VOT: Ошибка инициализации Базы Данных: ${openRequest.error.message}`
      );
      reject(false);
    };

    openRequest.onupgradeneeded = (event) => {
      const db = openRequest.result;

      db.onerror = () => {
        alert("VOT: Не удалось получить объект базы данных");
        console.error(
          `VOT: Не удалось загрузить базу данных: ${openRequest.error}`
        );
        reject(false);
      };

      if (event.oldVersion < 1) {
        // db not found
        const objectStore = db.createObjectStore("settings", { keyPath: "key" });

        objectStore.createIndex("autoTranslate", "autoTranslate", {
          unique: false,
        });
        objectStore.createIndex("defaultVolume", "defaultVolume", {
          unique: false,
        });
        objectStore.createIndex("showVideoSlider", "showVideoSlider", {
          unique: false,
        });
        objectStore.createIndex("syncVolume", "syncVolume", { unique: false });
        objectStore.createIndex(
          "autoSetVolumeYandexStyle",
          "autoSetVolumeYandexStyle",
          { unique: false }
        );
        objectStore.createIndex(
          "dontTranslateRuVideos",
          "dontTranslateRuVideos",
          { unique: false }
        );

        console.log("VOT: База Данных создана");

        objectStore.transaction.oncomplete = (event) => {
          const objectStore = db
            .transaction("settings", "readwrite")
            .objectStore("settings");
          const request = objectStore.add(settingsDefault);

          request.onsuccess = () => {
            console.log(
              "VOT: Стандартные настройки добавлены в Базу Данных: ",
              request.result
            );
            resolve(true);
          };

          request.onerror = () => {
            console.log(
              "VOT: Ошибка при добавление стандартных настроек в Базу Данных: ",
              request.error
            );
            reject(false);
          };
        };
      }

      if (event.oldVersion < 2) {
        // db is outdated (db version is 1)
        const transaction = openRequest.transaction;
        const objectStore = transaction.objectStore("settings");
        objectStore.createIndex("audioProxy", "audioProxy", { unique: false });
        console.log("VOT: База Данных обновлена до 2-й версии");

        objectStore.transaction.oncomplete = (event) => {
          const objectStore = db
            .transaction("settings", "readwrite")
            .objectStore("settings");
          const request = objectStore.get("settings");

          request.onerror = (event) => {
            console.error(
              "VOT: Не удалось получить данные из Базы Данных: ",
              event.error
            );
            reject(false);
          };

          request.onsuccess = () => {
            const data = request.result || settingsDefault; // use data from db or reset all data
            data.audioProxy = 0; // add default value for new index

            const requestUpdate = objectStore.put(data);

            requestUpdate.onerror = (event) => {
              console.error(
                "VOT: Не удалось обновить Базу Данных до 2 версии: ",
                event.error
              );
              reject(false);
            };

            requestUpdate.onsuccess = () => {
              console.log("VOT: Стандартные настройки 2-й версии добавлены в Базу Данных.");
              resolve(true);
            };
          };
        };
      }
    };

    openRequest.onsuccess = () => {
      const db = openRequest.result;
      db.onversionchange = () => {
        db.close();
        alert(
          "Базе данных нужно обновление, пожалуйста, перезагрузите страницу."
        );
        console.log(
          "VOT: Базе данных нужно обновление, пожалуйста, перезагрузите страницу"
        );
        window.location.reload();
        reject(false);
      };
      resolve(true);
    };

    openRequest.onblocked = () => {
      const db = openRequest.result;
      console.error(
        "VOT: База Данных временно заблокирована из-за ошибки: ",
        db
      );
      alert(
        "VOT отключен из-за ошибки при обновление Базы Данных. Закройте все открытые вкладки с youtube.com и попробуйте снова."
      );
      reject(false);
    };
  });
}

async function updateDB({
  autoTranslate,
  defaultVolume,
  showVideoSlider,
  syncVolume,
  autoSetVolumeYandexStyle,
  dontTranslateRuVideos,
  audioProxy,
}) {
  return new Promise((resolve, reject) => {
    if (
      typeof autoTranslate === "number" ||
      typeof defaultVolume === "number" ||
      typeof showVideoSlider === "number" ||
      typeof syncVolume === "number" ||
      typeof autoSetVolumeYandexStyle === "number" ||
      typeof dontTranslateRuVideos === "number" ||
      typeof audioProxy === "number"
    ) {
      const openRequest = openDB("VOT");

      openRequest.onerror = () => {
        alert("VOT: Произошла ошибка");
        console.error(`VOT: Ошибка Базы Данных: ${openRequest.error.message}`);
        reject(false);
      };

      openRequest.onupgradeneeded = async () => {
        const db = openRequest.result;
        db.close();
        await initDB();
        resolve(true);
      };

      openRequest.onsuccess = () => {
        const db = openRequest.result;
        db.onversionchange = () => {
          db.close();
          console.log(
            "VOT: Базе данных нужно обновление, пожалуЙста, перезагрузите страницу"
          );
          window.location.reload();
          reject(false);
        };

        const objectStore = db
          .transaction("settings", "readwrite")
          .objectStore("settings");
        const request = objectStore.get("settings");

        request.onerror = (event) => {
          console.error(
            "VOT: Не удалось получить данные из Базы Данных: ",
            event.error
          );
          reject(false);
        };

        request.onsuccess = () => {
          // console.log('VOT: Получены данные из Базы Данных: ', request.result);
          const data = request.result;

          if (typeof autoTranslate === "number") {
            data.autoTranslate = autoTranslate;
          }

          if (typeof defaultVolume === "number") {
            data.defaultVolume = defaultVolume;
          }

          if (typeof showVideoSlider === "number") {
            data.showVideoSlider = showVideoSlider;
          }

          if (typeof syncVolume === "number") {
            data.syncVolume = syncVolume;
          }

          if (typeof autoSetVolumeYandexStyle === "number") {
            data.autoSetVolumeYandexStyle = autoSetVolumeYandexStyle;
          }

          if (typeof dontTranslateRuVideos === "number") {
            data.dontTranslateRuVideos = dontTranslateRuVideos;
          }

          if (typeof audioProxy === "number") {
            data.audioProxy = audioProxy;
          }

          const requestUpdate = objectStore.put(data);

          requestUpdate.onerror = (event) => {
            console.error(
              "VOT: Не удалось обновить данные в Базе Данных: ",
              event.error
            );
            reject(false);
          };

          requestUpdate.onsuccess = () => {
            // console.log('VOT: Данные в Базе Данных обновлены, вы великолепны!');
            resolve(true);
          };
        };
      };

      openRequest.onblocked = () => {
        const db = openRequest.result;
        console.error(
          "VOT: База Данных временно заблокирована из-за ошибки: ",
          db
        );
        alert(
          "VOT отключен из-за ошибки при обновление Базы Данных. Закройте все открытые вкладки с youtube.com и попробуйте снова."
        );
        reject(false);
      };
    }
  });
}

async function readDB() {
  return new Promise((resolve, reject) => {
    const openRequest = openDB("VOT");

    openRequest.onerror = () => {
      alert("VOT: Произошла ошибка");
      console.error(`VOT: Ошибка Базы Данных: ${openRequest.error.message}`);
      reject(false);
    };

    openRequest.onupgradeneeded = async () => {
      const db = openRequest.result;
      db.close();
      await initDB();
      resolve(true);
    };

    openRequest.onsuccess = () => {
      const db = openRequest.result;
      db.onversionchange = () => {
        db.close();
        alert("VOT: База данных устарела, пожалуЙста, перезагрузите страницу.");
        reject(false);
      };

      const objectStore = db.transaction("settings").objectStore("settings");
      const request = objectStore.get("settings");

      request.onerror = (event) => {
        console.error(
          "VOT: Не удалось получить данные из Базы Данных: ",
          event.error
        );
        console.error(event);
        reject(false);
      };

      request.onsuccess = () => {
        // console.log('VOT: Получены данные из Базы Данных: ', request.result);
        if (request.result === undefined) {
          db.close();
          deleteDB();
          reject(false);
        }
        const data = request.result;
        resolve(data);
      };
    };

    openRequest.onblocked = () => {
      const db = openRequest.result;
      console.error(
        "VOT: База Данных временно заблокирована из-за ошибки: ",
        db
      );
      alert(
        "VOT отключен из-за ошибки при обновление Базы Данных. Закройте все открытые вкладки с youtube.com и попробуйте снова."
      );
      reject(false);
    };
  });
}

function deleteDB() {
  indexedDB.deleteDatabase("VOT");
}

export { initDB, readDB, updateDB, deleteDB };
