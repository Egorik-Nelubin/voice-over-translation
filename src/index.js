import "./styles/main.css";
import { getYTVideoData } from "./utils/getYTVideoData.js";
import { yandexRequests } from "./yandexRequests.js";
import { waitForElm, getVideoId, sleep, secsToStrTime } from "./utils/utils.js";
import { autoVolume } from "./config/config.js";
import { sitesInvidious, sitesPiped } from "./config/alternativeUrls.js";
import {
  translateFuncParam,
  availableFromLangs,
  availableToLangs,
  siteTranslates,
} from "./config/constants.js";
import { initDB, readDB, updateDB, deleteDB } from "./indexedDB.js";
import {
  transformBtn,
  addTranslationBlock,
  createTranslationMenu,
  createMenuCheckbox,
  createMenuSlider,
  createMenuSelect,
} from "./menu.js";
import { syncVolume } from "./utils/volume.js";
import { workerHost } from "./config/config-cloudflare.js";
import regexes from "./config/regexes.js";
import selectors from "./config/selectors.js";
import debug from "./utils/debug.js";

const sitesChromiumBlocked = [...sitesInvidious, ...sitesPiped];

// translate properties
let translateFromLang = "en"; // default language of video

let translateToLang = "ru"; // default language of audio response

async function main() {
  debug.log("Loading extension...");

  const rvt = await import(
    `./rvt${BUILD_MODE === "cloudflare" ? "-cloudflare" : ""}.js`
  );

  const requestVideoTranslation = rvt.default;

  debug.log("Inited requestVideoTranslation...");

  if (
    BUILD_MODE !== "cloudflare" &&
    GM_info?.scriptHandler &&
    ["Violentmonkey", "FireMonkey", "Greasemonkey", "AdGuard"].includes(
      GM_info.scriptHandler
    )
  ) {
    const errorText = `VOT Ошибка!\n${GM_info.scriptHandler} не поддерживается этой версией расширения!\nПожалуйста, используйте спец. версию расширения.`;
    console.error(errorText);
    return alert(errorText);
  }

  debug.log("Extension compatibility passed...");

  let timer;
  const audio = new Audio();
  let opacityRatio = 0.9;
  let openedMenu = false;

  if (BUILD_MODE === "cloudflare") {
    var translationPanding = false;
  }

  function logout(n) {
    if (openedMenu) return;

    document.querySelector(".translationBlock").style.opacity = n;
  }

  function resetTimer() {
    clearTimeout(timer);
    logout(1);
    timer = setTimeout(() => {
      logout(0);
    }, 2000);
  }

  function changeOpacityOnEvent(event, timer, opacityRatio) {
    clearTimeout(timer);
    logout(opacityRatio);
    event.stopPropagation();
  }

  const deleteAudioSrc = () => {
    audio.src = "";
    audio.removeAttribute("src");
  };

  // Add menu container
  function addTranslationMenu(element) {
    if (element.querySelector(".translationMenuContent")) return;

    const container = createTranslationMenu();
    element.appendChild(container);

    // click to translation menu icon
    document
      .querySelector(".translationMenu")
      ?.addEventListener("click", (event) => {
        event.stopPropagation();
        const content = document.querySelector(".translationMenuContent");
        content.style.display = openedMenu ? "none" : "block";
        content.style.opacity = opacityRatio;
        openedMenu = !openedMenu;
      });

    document
      .querySelector(".translationDropDB")
      .addEventListener("click", (event) => {
        event.stopPropagation();
        deleteDB();
        location.reload();
      });

    debug.log("VOT: Added translation menu to ", element);
  }

  function translateVideo(url, unknown1, requestLang, responseLang, callback) {
    debug.log(
      `Translate video (url: ${url}, unknown1: ${unknown1}, requestLang: ${requestLang}, responseLang: ${responseLang})`
    );

    if (BUILD_MODE === "cloudflare" && translationPanding) {
      debug.log("translationPanding return");
      return;
    }

    translationPanding = true;

    requestVideoTranslation(
      url,
      unknown1,
      requestLang,
      responseLang,
      (success, response) => {
        translationPanding = false;

        debug.log("[exec callback] Requesting video translation");
        if (!success) {
          callback(false, "Не удалось запросить перевод видео");
          return;
        }

        const translateResponse = yandexRequests.decodeResponse(response);
        console.log("VOT Response: ", translateResponse);

        switch (translateResponse.status) {
          case 0:
            callback(false, translateResponse.message);
            break;
          case 1:
            callback(
              !!translateResponse.url,
              translateResponse.url || "Не получена ссылка на аудио"
            );
            break;
          case 2:
            callback(
              false,
              translateResponse.remainingTime
                ? secsToStrTime(translateResponse.remainingTime)
                : "Перевод займет несколько минут"
            );
            break;
          case 3:
            /*
              Иногда, в ответе приходит статус код 3, но видео всё, так же, ожидает перевода. В конечном итоге, это занимает слишком много времени,
              как-будто сервер не понимает, что данное видео уже недавно было переведено и заместо возвращения готовой ссылки на перевод начинает переводить видео заново при чём у него это получается за очень длительное время
            */
            callback(false, "Видео переводится");
            break;
        }
      }
    );
  }

  async function translateProccessor(videoContainer, siteHostname, siteEvent) {
    debug.log("[translateProccessor] execute on element: ", videoContainer);

    let video;
    let autoRetry;
    let volumeOnStart;
    let tempOriginalVolume;
    let tempVolume;
    let dbAutoTranslate;
    let dbDefaultVolume;
    let dbShowVideoSlider;
    let dbAutoSetVolumeYandexStyle;
    let dbDontTranslateRuVideos;
    let dbSyncVolume;
    let dbAudioProxy; // cf version only
    let firstPlay = true;
    let isDBInited;

    debug.log("videoContainer", videoContainer);

    video =
      siteHostname === "vimeo"
        ? videoContainer.querySelector(
            ".vp-video-wrapper > .vp-video > .vp-telecine > video"
          )
        : videoContainer.querySelector("video");

    debug.log("video", video);

    let videoData = getVideoData();
    console.log("VOT Video Data: ", videoData);

    const container =
    siteHostname === "pornhub" &&
    window.location.pathname.includes("view_video.php")
    ? document.querySelector(".original.mainPlayerDiv")
    : siteHostname === "pornhub" &&
    window.location.pathname.includes("embed/")
    ? document.querySelector("body")
    : window.location.hostname.includes("m.youtube.com")
    ? document.querySelector("#player-control-container")
    : videoContainer;

    addTranslationBlock(container);
    addTranslationMenu(container);


    try {
      isDBInited = await initDB();
    } catch (err) {
      console.error(
        "[VOT] Не удалось инициализировать настройки базы данных. Все внесенные изменения не будут сохранены",
        err
      );
    }

    const menuOptions = document.querySelector(".translationMenuOptions");
    if (
      menuOptions &&
      !menuOptions.querySelector("#VOTTranslateFromLang")
    ) {
      const selectFromLangOptions = [
        {
          label: "Язык видео",
          value: "default",
          disabled: true,
        },
        ...Object.entries(availableFromLangs).map(([key, value]) => ({
          label: value,
          value: key,
          selected: videoData.detectedLanguage === key,
        })),
      ];

      const selectToLangOptions = [
        {
          label: "Язык перевода",
          value: "default",
          disabled: true,
        },
      ];

      for (const [key, value] of Object.entries(availableToLangs)) {
        selectToLangOptions.push({
          label: value,
          value: key,
          selected: videoData.responseLanguage === key,
        });
      }

      const selectFromLang = createMenuSelect(
        "VOTTranslateFromLang",
        selectFromLangOptions
      );

      const selectToLang = createMenuSelect(
        "VOTTranslateToLang",
        selectToLangOptions
      ).firstElementChild;

      selectFromLang.id = "VOTSelectLanguages";
      selectFromLang.innerHTML += `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 12h16m0 0l-6 6m6-6l-6-6"/>
        </svg>
      `;

      selectFromLang.appendChild(selectToLang);
      menuOptions.appendChild(selectFromLang);

      menuOptions
        .querySelector("#VOTTranslateFromLang")
        .addEventListener("change", (event) => {
          debug.log("[onchange] select from language", event.target.value);
          videoData = setDetectedLangauge(videoData, event.target.value);
        });

      menuOptions
        .querySelector("#VOTTranslateToLang")
        .addEventListener("change", (event) => {
          debug.log("[onchange] select to language", event.target.value);
          videoData = setResponseLangauge(videoData, event.target.value);
        });
    }

    if (isDBInited) {
      const dbData = await readDB();
      if (dbData) {
        dbAutoTranslate = dbData.autoTranslate;
        dbDefaultVolume = dbData.defaultVolume;
        dbShowVideoSlider = dbData.showVideoSlider;
        dbAutoSetVolumeYandexStyle = dbData.autoSetVolumeYandexStyle;
        dbDontTranslateRuVideos = dbData.dontTranslateRuVideos;
        dbAudioProxy = dbData.audioProxy; // cf version only
        // only youtube:
        dbSyncVolume = dbData.syncVolume;

        debug.log("[db] data from db: ", dbData);

        if (
          dbAutoTranslate !== undefined &&
          menuOptions &&
          !menuOptions.querySelector("#VOTAutoTranslate")
        ) {
          const checkbox = createMenuCheckbox(
            "VOTAutoTranslate",
            dbAutoTranslate,
            `Переводить при открытии${
              siteHostname === "vk" ||
              window.location.hostname.includes("m.twitch.tv")
                ? " <strong>(рекомендуется)</strong>"
                : ""
            }`
          );

          checkbox.querySelector("#VOTAutoTranslate").onclick = async (
            event
          ) => {
            event.stopPropagation();
            const value = Number(event.target.checked);
            await updateDB({ autoTranslate: value });
            dbAutoTranslate = value;
            debug.log(
              "autoTranslate value changed. New value: ",
              dbAutoTranslate
            );
          };

          menuOptions.appendChild(checkbox);
        }

        if (
          window.location.hostname.includes("youtube.com") &&
          dbDontTranslateRuVideos !== undefined &&
          menuOptions &&
          !menuOptions.querySelector("#VOTDontTranslateRu")
        ) {
          const checkbox = createMenuCheckbox(
            "VOTDontTranslateRu",
            dbDontTranslateRuVideos,
            "Не переводить с русского"
          );

          checkbox.querySelector("#VOTDontTranslateRu").onclick = async (
            event
          ) => {
            event.stopPropagation();
            const value = Number(event.target.checked);
            await updateDB({ dontTranslateRuVideos: value });
            dbDontTranslateRuVideos = value;
            debug.log(
              "dontTranslateRuVideos value changed. New value: ",
              dbDontTranslateRuVideos
            );
          };

          menuOptions.appendChild(checkbox);
        }

        if (
          dbAutoSetVolumeYandexStyle !== undefined &&
          menuOptions &&
          !menuOptions.querySelector("#VOTAutoSetVolume")
        ) {
          const checkbox = createMenuCheckbox(
            "VOTAutoSetVolume",
            dbAutoSetVolumeYandexStyle,
            `Уменьшать громкость видео до ${autoVolume * 100}%`
          );

          checkbox.querySelector("#VOTAutoSetVolume").onclick = async (
            event
          ) => {
            event.stopPropagation();
            const value = Number(event.target.checked);
            await updateDB({ autoSetVolumeYandexStyle: value });
            dbAutoSetVolumeYandexStyle = value;
            debug.log(
              "autoSetVolumeYandexStyle value changed. New value: ",
              dbAutoSetVolumeYandexStyle
            );
          };

          menuOptions.appendChild(checkbox);
        }

        if (
          dbShowVideoSlider !== undefined &&
          menuOptions &&
          !menuOptions.querySelector("#VOTShowVideoSlider")
        ) {
          const checkbox = createMenuCheckbox(
            "VOTShowVideoSlider",
            dbShowVideoSlider,
            "Слайдер громкости видео"
          );

          checkbox.querySelector("#VOTShowVideoSlider").onclick = async (
            event
          ) => {
            event.stopPropagation();
            const value = Number(event.target.checked);
            await updateDB({ showVideoSlider: value });
            dbShowVideoSlider = value;
            debug.log(
              "showVideoSlider value changed. New value: ",
              dbShowVideoSlider
            );
            if (
              dbShowVideoSlider === 1 &&
              document.querySelector(".translationBtn").dataset.state ===
                "success"
            ) {
              addVideoSlider();
            } else {
              document.querySelector("#VOTVideoSlider")?.parentElement.remove();
            }
          };

          menuOptions.appendChild(checkbox);
        }

        if (
          window.location.hostname.includes("youtube.com") &&
          !window.location.hostname.includes("m.youtube.com") &&
          dbSyncVolume !== undefined &&
          menuOptions &&
          !menuOptions.querySelector("#VOTSyncVolume")
        ) {
          const checkbox = createMenuCheckbox(
            "VOTSyncVolume",
            dbSyncVolume,
            "Связать громкость перевода и видео"
          );

          checkbox.querySelector("#VOTSyncVolume").onclick = async (event) => {
            event.stopPropagation();
            const value = Number(event.target.checked);
            await updateDB({ syncVolume: value });
            dbSyncVolume = value;
            debug.log("syncVolume value changed. New value: ", dbSyncVolume);
          };

          menuOptions.appendChild(checkbox);
        }

        // cf version only
        if (
          BUILD_MODE === "cloudflare" &&
          dbAudioProxy !== undefined &&
          menuOptions &&
          !menuOptions.querySelector("#VOTAudioProxy")
        ) {
          const checkbox = createMenuCheckbox(
            "VOTAudioProxy",
            dbAudioProxy,
            "Проксировать полученное аудио"
          );

          checkbox.querySelector("#VOTAudioProxy").onclick = async (event) => {
            event.stopPropagation();
            const value = Number(event.target.checked);
            await updateDB({ audioProxy: value });
            dbAudioProxy = value;
            debug.log("audioProxy value changed. New value: ", dbAudioProxy);
          };

          menuOptions.appendChild(checkbox);
        }
      }
    }

    transformBtn("none", "Перевести видео");

    if (
      window.location.hostname.includes("youtube.com") &&
      !window.location.hostname.includes("m.youtube.com")
    ) {
      const syncVolumeObserver = new MutationObserver(async function (
        mutations
      ) {
        mutations.forEach(async function (mutation) {
          if (
            mutation.type === "attributes" &&
            mutation.attributeName === "aria-valuenow" &&
            document.querySelector("#VOTVideoSlider")
          ) {
            syncVideoVolumeSlider();
          }
        });
      });

      syncVolumeObserver.observe(document.querySelector(".ytp-volume-panel"), {
        attributes: true,
        childList: false,
        subtree: true,
        attributeOldValue: true,
      });
    }

    function setSelectMenuValues(from, to) {
      if (!document.querySelector("#VOTSelectLanguages")) {
        return;
      }
      console.log(`Set translation from ${from} to ${to}`);
      document.querySelector("#VOTTranslateFromLang").value = from;
      document.querySelector("#VOTTranslateToLang").value = to;
    }

    // data - ytData or VideoData
    function setDetectedLangauge(data, lang) {
      switch (lang) {
        case "en":
          data.detectedLanguage = lang;
          data.responseLanguage = "ru";
          break;
        case "ru":
          data.detectedLanguage = lang;
          data.responseLanguage = "en";
          break;
        default:
          if (!Object.keys(availableFromLangs).includes(lang)) {
            return setDetectedLangauge(data, "en");
          }

          data.detectedLanguage = lang;
      }

      setSelectMenuValues(data.detectedLanguage, data.responseLanguage);

      return data;
    }

    // data - ytData or VideoData
    function setResponseLangauge(data, lang) {
      switch (lang) {
        case "en":
          data.responseLanguage = lang;
          data.detectedLanguage = "ru";
          break;
        default:
          if (!Object.keys(availableToLangs).includes(lang)) {
            return setResponseLangauge(data, "ru");
          }

          if (data.detectedLanguage === "ru" && lang === "ru") {
            data.detectedLanguage = "en";
          }

          data.responseLanguage = lang;
      }

      setSelectMenuValues(data.detectedLanguage, data.responseLanguage);

      return data;
    }

    function stopTraslate() {
      // Default actions on stop translate
      audio.pause();
      video.removeEventListener(".translate", stopTraslate, false);
      deleteAudioSrc();
      document.querySelector("#VOTVideoSlider")?.parentElement.remove();
      document.querySelector("#VOTTranslationSlider")?.parentElement.remove();
      const downloadBtn = document.querySelector(".translationDownload");
      downloadBtn.href = "";
      downloadBtn.style.display = "none";
      transformBtn("none", "Перевести видео");
      if (volumeOnStart) {
        video.volume = volumeOnStart;
      }
    }

    function syncVideoVolumeSlider() {
      // Sync volume slider with original video (youtube only)
      const newSlidersVolume = document
        .querySelector(".ytp-volume-panel")
        .getAttribute("aria-valuenow");

      const videoSlider = document.querySelector("#VOTVideoSlider");

      if (!videoSlider) {
        return;
      }
      videoSlider.value = newSlidersVolume;

      const videoVolumeLabel = document.querySelector("#VOTVideoVolume");

      if (videoVolumeLabel) {
        videoVolumeLabel.innerText = `${newSlidersVolume}%`;
      }

      if (dbSyncVolume === 1) {
        tempOriginalVolume = Number(newSlidersVolume);
      }
    }

    function getVideoData() {
      const videoData = {};

      videoData.duration = video?.duration || 0;

      videoData.videoId = getVideoId(siteHostname);

      videoData.detectedLanguage = translateFromLang;

      videoData.responseLanguage = translateToLang;

      if (window.location.hostname.includes("youtube.com")) {
        let ytData = getYTVideoData();
        ytData = setDetectedLangauge(ytData, ytData.detectedLanguage);
        videoData.detectedLanguage = ytData.detectedLanguage;
        videoData.responseLanguage = ytData.responseLanguage;
      } else if (
        window.location.hostname.includes("rutube") ||
        window.location.hostname.includes("my.mail.ru")
      ) {
        videoData.detectedLanguage = "ru";
        videoData.responseLanguage = "en";
      } else if (window.location.hostname.includes("bilibili.com")) {
        videoData.detectedLanguage = "zh";
      }

      return videoData;
    }

    const lipSync = (mode = false) => {
      debug.log("lipsync video", video);
      if (!video) {
        return;
      }
      audio.currentTime = video.currentTime;
      audio.playbackRate = video.playbackRate;

      if (!mode) {
        debug.log("lipsync mode is not set");
        return;
      }

      if (mode === "play") {
        debug.log("lipsync mode is play");
        const audioPromise = audio.play();
        if (audioPromise !== undefined) {
          audioPromise.catch((e) => {
            console.error(e);
            if (e.name === "NotAllowedError") {
              transformBtn(
                "error",
                "Предоставьте разрешение на автовоспроизведение"
              );
              throw "VOT: Предоставьте разрешение на автовоспроизведение";
            } else if (e.name === "NotSupportedError") {
              const errorMessage = sitesChromiumBlocked.includes(
                window.location.hostname
              )
                ? "Для поддержки этого сайта необходимо дополнительное расширение"
                : "Формат аудио не поддерживается";
              transformBtn("error", errorMessage);
              throw `VOT: ${errorMessage}`;
            }
          });
        }
        return;
      }
      if (mode === "pause") {
        debug.log("lipsync mode is pause");
        audio.pause();
      }
    };

    function addVideoSlider() {
      if (
        dbShowVideoSlider !== 1 ||
        document.querySelector("#VOTVideoSlider") ||
        document.querySelector(".translationBtn").dataset.state !== "success"
      ) {
        return;
      }

      const newVolume =
        window.location.hostname.includes("youtube.com") &&
        !dbAutoSetVolumeYandexStyle
          ? document
              .querySelector(".ytp-volume-panel")
              ?.getAttribute("aria-valuenow")
          : Math.round(video.volume * 100);
      tempOriginalVolume = newVolume;

      const slider = createMenuSlider(
        "VOTVideoSlider",
        newVolume,
        `Громкость видео: <b class = "volumePercent" id="VOTOriginalVolume">${newVolume}%</b>`
      );

      slider.querySelector("#VOTVideoSlider").oninput = (event) => {
        const { value } = event.target;
        video.volume = value / 100;
        slider.querySelector("#VOTOriginalVolume").innerText = `${value}%`;

        if (dbSyncVolume !== 1) {
          return;
        }

        // Sync translation volume slider with video volume slider
        const translateVolumeSlider = document.querySelector(
          "#VOTTranslationSlider"
        );

        if (!translateVolumeSlider) {
          return;
        }
        const translateVolume = Number(translateVolumeSlider.value);
        const finalValue = syncVolume(
          audio,
          value,
          translateVolume,
          tempOriginalVolume
        );

        translateVolumeSlider.value = finalValue;

        const translateVolumeLabel = document.querySelector(
          "#VOTTranslationVolume"
        );

        if (translateVolumeLabel) {
          translateVolumeLabel.innerText = `${finalValue}%`;
        }

        tempVolume = finalValue;
        tempOriginalVolume = value;
      };

      const menuOptions = document.querySelector(".translationMenuOptions");
      menuOptions.appendChild(slider);
    }

    function addTranslationSlider() {
      // Return early if slider already exists or translation is not successful
      if (
        document.querySelector("#VOTTranslationSlider") ||
        document.querySelector(".translationBtn").dataset.state !== "success"
      ) {
        return;
      }

      // Use dbDefaultVolume or 100 as the default translation volume
      const defaultTranslateVolume =
        typeof dbDefaultVolume === "number" ? dbDefaultVolume : 100;
      tempOriginalVolume = defaultTranslateVolume;

      // Create a slider element with the default volume and label
      const slider = createMenuSlider(
        "VOTTranslationSlider",
        defaultTranslateVolume,
        `Громкость перевода: <b class = "volumePercent" id="VOTTranslationVolume">${defaultTranslateVolume}%</b>`
      );

      // Add an input event listener to the slider
      slider.querySelector("#VOTTranslationSlider").oninput = async ({
        target: { value },
      }) => {
        // Set the audio volume to the slider value
        audio.volume = value / 100;

        // Update the volume label
        document.querySelector("#VOTTranslationVolume").innerText = `${value}%`;

        // Update the database with the new volume value
        await updateDB({ defaultVolume: Number(value) });
        dbDefaultVolume = Number(value);

        // Sync translation volume with video volume if dbSyncVolume is 1
        if (dbSyncVolume === 1) {
          syncTranslationWithVideo(value);
        }
      };

      // Append the slider to the menu options
      const menuOptions = document.querySelector(".translationMenuOptions");
      menuOptions.appendChild(slider);
    }

    // A helper function to sync translation volume with video volume
    function syncTranslationWithVideo(translationValue) {
      // Get the video volume slider element
      const videoVolumeSlider = document.querySelector("#VOTVideoSlider");

      if (!videoVolumeSlider) {
        return;
      }
      // Get the video volume value
      const videoVolume = Number(videoVolumeSlider.value);

      // Calculate the synced video volume based on the translation volume
      const finalValue = syncVolume(
        video,
        translationValue,
        videoVolume,
        tempVolume
      );

      // Set the video volume slider value to the synced value
      videoVolumeSlider.value = finalValue;

      // Update the video volume label
      const videoVolumeLabel = document.querySelector("#VOTOriginalVolume");
      if (videoVolumeLabel) videoVolumeLabel.innerText = `${finalValue}%`;

      // Update the temp variables for future syncing
      tempOriginalVolume = finalValue;
      tempVolume = translationValue;
    }

    function videoValidator() {
      // Костыль, но работает. тупой баг свзян с тем что функция videoValidator может считать videoData.detectedLanguage неверно, когда с ytData.detectedLanguage всё работает отлично
      // Иногда код может начать перевод русского видео из-за этого бага
      // Прошу тебя доразбирись за меня
      if (window.location.hostname.includes("youtube.com")) {
        let ytData = getYTVideoData();
        ytData = setDetectedLangauge(ytData, ytData.detectedLanguage);
        debug.log("VideoValidator videoData: ", videoData);
        if (dbDontTranslateRuVideos === 1 && ytData.detectedLanguage === "ru") {
          firstPlay = false;
          throw "VOT: Вы отключили перевод русскоязычных видео";
        }

        if (ytData.isLive) {
          throw "VOT: Не поддерживается перевод трансляций в прямом эфире";
        }

        if (ytData.isPremiere) {
          throw "VOT: Дождитесь окончания премьеры перед переводом";
        }
        if (videoData.duration > 14_400) {
          throw "VOT: Видео слишком длинное";
        }
      }
      return true;
    }

    const translateExecutor = (VIDEO_ID) => {
      debug.log("Run videoValidator");
      videoValidator();
      debug.log("Run translateFunc");
      translateFunc(
        VIDEO_ID,
        videoData.detectedLanguage,
        videoData.responseLanguage
      );
    };

    // Define a function to handle common events
    function handleVideoEvent(event) {
      debug.log(`video ${event.type}`);
      lipSync(event.type);
    }

    // Define a function to stop translation and clean up
    function stopTranslation() {
      stopTraslate();
      syncVideoVolumeSlider();
    }

    // Define a function to translate a video and handle the callback
    function translateFunc(VIDEO_ID, requestLang, responseLang) {
      const videoURL = `${siteTranslates[siteHostname]}${VIDEO_ID}`;
      translateVideo(
        videoURL,
        translateFuncParam,
        requestLang,
        responseLang,
        async (success, urlOrError) => {
          debug.log("[exec callback] translateVideo");
          if (getVideoId(siteHostname) !== VIDEO_ID) return;
          if (!success) {
            transformBtn("error", urlOrError);
            if (urlOrError.includes("Перевод займёт")) {
              clearTimeout(autoRetry);
              autoRetry = setTimeout(
                () => translateFunc(VIDEO_ID, requestLang, responseLang),
                60_000
              );
            }
            throw urlOrError;
          }

          audio.src = urlOrError;

          // cf version only
          if (BUILD_MODE === "cloudflare" && dbAudioProxy === 1 && urlOrError.startsWith("https://")) {
            const audioPath = urlOrError.replace("https://vtrans.s3-private.mds.yandex.net/tts/prod/", "");
            const proxiedAudioUrl = `https://${workerHost}/video-translation/audio-proxy/${audioPath}`;
            console.log(`VOT Audio proxied via ${proxiedAudioUrl}`);
            audio.src = proxiedAudioUrl;
          }

          volumeOnStart = video?.volume;
          if (typeof dbDefaultVolume === "number") {
            audio.volume = dbDefaultVolume / 100;
          }
          if (
            typeof dbAutoSetVolumeYandexStyle === "number" &&
            dbAutoSetVolumeYandexStyle
          ) {
            video.volume = autoVolume;
          }

          switch (siteHostname) {
            case "twitter":
              document
                .querySelector('div[data-testid="app-bar-back"][role="button"]')
                .addEventListener("click", stopTranslation);
              break;
            case "invidious":
            case "piped":
              break;
            default:
              if (siteEvent !== null) {
                document.body.addEventListener(siteEvent, stopTranslation);
              }
              break;
          }

          const siteHostnames = [
            "twitch",
            "vimeo",
            "facebook",
            "rutube",
            "twitter",
            "bilibili.com",
            "mail.ru",
          ];
          for (let i = 0; i < siteHostnames.length; i++) {
            if (siteHostname === siteHostnames[i]) {
              const mutationObserver = new MutationObserver(
                async (mutations) => {
                  mutations.forEach(async (mutation) => {
                    if (
                      mutation.type === "attributes" &&
                      mutation.attributeName === "src" &&
                      mutation.target === video &&
                      mutation.target.src !== ""
                    ) {
                      stopTranslation();
                      firstPlay = true;
                    }
                  });
                }
              );
              mutationObserver.observe(videoContainer, {
                attributes: true,
                childList: false,
                subtree: true,
                attributeOldValue: true,
              });
              break;
            }
          }

          if (video && !video.paused) lipSync("play");
          const videos = document.querySelectorAll("video");
          const events = [
            "playing",
            "ratechange",
            "play",
            "canplaythrough",
            "pause",
            "waiting",
          ];
          videos.forEach((v) =>
            events.forEach((e) => v.addEventListener(e, handleVideoEvent))
          );
          transformBtn("success", "Выключить");
          addVideoSlider();
          addTranslationSlider();

          const VOTVideoSlider = document.querySelector("#VOTVideoSlider");
          if (VOTVideoSlider) VOTVideoSlider.value = autoVolume * 100;

          const VOTOriginalVolume =
            document.querySelector("#VOTOriginalVolume");
          if (VOTOriginalVolume) {
            VOTOriginalVolume.innerText = `${autoVolume * 100}%`;
          }

          const downloadBtn = document.querySelector(".translationDownload");
          downloadBtn.href = urlOrError;
          downloadBtn.style.display = "initial";
        }
      );
    }

    document.addEventListener("click", (event) => {
      const block = document.querySelector(".translationBlock");
      const menuContainer = document.querySelector(".translationMenuContent");
      const isBlock =
        block || event.target === block ? block.contains(event.target) : false;
      const isContent =
        menuContainer || event.target === menuContainer
          ? menuContainer.contains(event.target)
          : false;
      const isVideo =
        videoContainer || event.target === videoContainer
          ? videoContainer.contains(event.target)
          : false;

      debug.log(`[document click] ${isBlock} ${isContent} ${isVideo}`);
      if (!(!isBlock && !isContent)) return;
      if (!isVideo) logout(0);

      menuContainer.style.display = "none";
      openedMenu = false;
    });

    const addEventListeners = (element, events, handler) => {
      events.forEach((event) => element.addEventListener(event, handler));
    };

    if (siteHostname === "pornhub") {
      if (window.location.pathname.includes("view_video.php")) {
        const videoElement = document.querySelector(
          ".original.mainPlayerDiv > video-element > div"
        );
        addEventListeners(videoElement, ["mousemove", "mouseout"], resetTimer);
      } else if (window.location.pathname.includes("embed/")) {
        const playerElement = document.querySelector("#player");
        addEventListeners(playerElement, ["mousemove", "mouseout"], resetTimer);
      }
    } else if (siteHostname === "twitter") {
      const videoPlayerElement = document.querySelector(
        'div[data-testid="videoPlayer"'
      );
      addEventListeners(
        videoPlayerElement,
        ["mousemove", "mouseout"],
        resetTimer
      );
    } else {
      addEventListeners(videoContainer, ["mousemove", "mouseout"], resetTimer);
    }

    document
      .querySelector(".translationBlock")
      .addEventListener("mousemove", (event) =>
        changeOpacityOnEvent(event, timer, opacityRatio)
      );
    document
      .querySelector(".translationMenuContent")
      .addEventListener("mousemove", (event) =>
        changeOpacityOnEvent(event, timer, opacityRatio)
      );

    document.addEventListener("touchstart", (event) =>
      changeOpacityOnEvent(event, timer, opacityRatio)
    );
    document.addEventListener("touchmove", (event) =>
      changeOpacityOnEvent(event, timer, opacityRatio)
    );
    document.addEventListener("touchend", (event) =>
      changeOpacityOnEvent(event, timer, opacityRatio)
    );

    document
      .querySelector(".translationBtn")
      .addEventListener("click", async (event) => {
        debug.log("[click translationBtn] before all functions & methods");
        event.stopPropagation();
        event.stopImmediatePropagation();

        // check if the audio source is not empty
        if (audio.src) {
          debug.log("[click translationBtn] audio.src is not empty");
          stopTraslate();
          return;
        }

        try {
          debug.log("[click translationBtn] trying execute translation");
          const VIDEO_ID = getVideoId(siteHostname);

          if (!VIDEO_ID) {
            throw "VOT: Не найдено ID видео"; // not found video id
          }

          translateExecutor(VIDEO_ID);
        } catch (err) {
          transformBtn("error", String(err).substring(4, err.length));
          console.error(err);
        }
      });

    video.addEventListener("progress", (event) => {
      event.stopPropagation();

      if (!(firstPlay && dbAutoTranslate === 1)) {
        return;
      }
      const VIDEO_ID = getVideoId(siteHostname);

      if (!VIDEO_ID) {
        throw "VOT: Не найдено ID видео";
      }

      try {
        translateExecutor(VIDEO_ID);
        firstPlay = false;
      } catch (err) {
        transformBtn("error", String(err).substring(4, err.length));
        firstPlay = false;
      }
    });
  }

  async function initWebsite() {
    debug.log("Runned initWebsite function");
    if (regexes.youtubeRegex.test(window.location.hostname)) {
      if (window.location.pathname.includes("embed")) {
        const videoContainer = document.querySelector(".html5-video-container");
        await translateProccessor(videoContainer, "youtube", null);
        return;
      }

      debug.log("[initWebsite] Found a match with youtube hostname");
      const ytPageEnter = () => {
        const videoContainer = document.querySelector(
          selectors.youtubeSelector
        );
        if (videoContainer) {
          debug.log("[exec] translateProccessor youtube on page enter");
          translateProccessor(videoContainer, "youtube", "yt-translate-stop");
        } else {
          if (!ytplayer || !ytplayer.config) {
            debug.log("[exec] ytplayer is null");
            return;
          }
          ytplayer.config.args.jsapicallback = () => {
            debug.log(
              "[exec] translateProccessor youtube on page enter (ytplayer.config.args.jsapicallback)"
            );
            translateProccessor(videoContainer, "youtube", "yt-translate-stop");
          };
        }
      };

      document.addEventListener("spfdone", ytPageEnter);
      document.addEventListener("yt-navigate-finish", ytPageEnter);

      const ytPageLeave = () => {
        document.body.dispatchEvent(new Event("yt-translate-stop"));
      };

      document.addEventListener("spfrequest", ytPageLeave);
      document.addEventListener("yt-navigate-start", ytPageLeave);

      if (window.location.hostname.includes("m.youtube.com")) {
        const observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            if (mutation.type === "attributes") {
              const videoContainer = mutation.target;
              translateProccessor(
                videoContainer,
                "youtube",
                "yt-translate-stop"
              );
            }
          }
        });

        const options = {
          attributes: true,
          childList: false,
          subtree: false,
        };

        const videoContainer = document.querySelector("#player");

        observer.observe(videoContainer, options);

        const ytPageLeave = () => {
          observer.disconnect();
          document.body.dispatchEvent(new Event("yt-translate-stop"));
        };
        document.addEventListener("spfrequest", ytPageLeave);
        document.addEventListener("yt-navigate-start", ytPageLeave);
      }
      return;
    }
    if (window.location.hostname.includes("twitch.tv")) {
      debug.log("[initWebsite] Found a match with twitch.tv");
      if (
        window.location.hostname.includes("m.twitch.tv") &&
        (window.location.pathname.includes("/videos/") ||
          window.location.pathname.includes("/clip/"))
      ) {
        debug.log("[initWebsite] Matched Twitch Mobile");
        const el = await waitForElm(selectors.twitchMobileSelector);
        if (el) {
          await sleep(200);
          const twitchMobileSelector = document.querySelector(
            selectors.twitchMobileSelector
          );
          await translateProccessor(twitchMobileSelector, "twitch", null);

          const mutationObserver = new MutationObserver(async (mutations) => {
            for (const mutation of mutations) {
              if (
                mutation.type === "attributes" &&
                mutation.attributeName === "src" &&
                mutation.target ===
                  twitchMobileSelector?.querySelector("video")
              ) {
                await sleep(1000);
                await translateProccessor(
                  twitchMobileSelector,
                  "twitch",
                  null
                );
              }
            }
          });

          mutationObserver.observe(twitchMobileSelector, {
            attributes: true,
            childList: true,
            subtree: true,
            attributeOldValue: true,
          });
        }
      } else if (
        window.location.hostname.includes("player.twitch.tv") ||
        window.location.hostname.includes("clips.twitch.tv") ||
        window.location.pathname.includes("/videos/") ||
        window.location.pathname.includes("/clip/")
      ) {
        debug.log("[initWebsite] Matched Twitch Desktop");
        const el = await waitForElm(selectors.twitchSelector);
        if (el) {
          await sleep(200);
          await translateProccessor(el, "twitch", null);
        }
      }
      debug.log("[initWebsite] Exit function in the twitch section");
      return;
    }
    if (window.location.hostname.includes("xvideos.com")) {
      debug.log("[entered] xvideos");
      await sleep(1000);
      await translateProccessor(
        document.querySelector(".video-bg-pic"),
        "xvideos",
        null
      );
      return;
    }
    if (window.location.hostname.includes("pornhub.com")) {
      debug.log("[entered] pornhub");
      await sleep(1000);
      await translateProccessor(
        document.querySelector(".mgp_videoWrapper"),
        "pornhub",
        null
      );
      return;
    }
    if (sitesInvidious.includes(window.location.hostname)) {
      // Need an additional extension to work in chrome-like browsers
      debug.log("[entered] invidious");
      await translateProccessor(
        document.querySelector("#player"),
        "youtube",
        null
      );
    } else if (sitesPiped.includes(window.location.hostname)) {
      // Need an additional extension to work in chrome-like browsers
      debug.log("[entered] piped");
      const el = await waitForElm(selectors.pipedSelector);
      if (el) {
        let videoIDNew;
        let videoID = getVideoId("youtube");
        await translateProccessor(el, "youtube", "piped");
        setInterval(async () => {
          videoIDNew = getVideoId("youtube");
          if (videoID !== videoIDNew) {
            if (videoIDNew) {
              await translateProccessor(
                document.querySelector(selectors.pipedSelector),
                "youtube",
                "piped"
              );
            }
            videoID = videoIDNew;
          }
        }, 3000);
      }
    } else if (/^(www.|m.)?vk.(com|ru)$/.test(window.location.hostname)) {
      debug.log("[entered] vk.com");
      const el = await waitForElm(selectors.vkSelector);
      if (el) {
        await translateProccessor(
          document.querySelector(selectors.vkSelector),
          "vk",
          null
        );
        let videoIDVKNew;
        let videoIDVK = getVideoId("vk");
        setInterval(async () => {
          videoIDVKNew = getVideoId("vk");
          if (videoIDVK !== videoIDVKNew) {
            if (videoIDVKNew) {
              const el = await waitForElm(selectors.vkSelector);
              if (el) {
                await translateProccessor(el, "vk", null);
              }
            }
            videoIDVK = videoIDVKNew;
          }
        }, 3000);
      }
    } else if (window.location.hostname.includes("vimeo.com")) {
      debug.log("[entered] vimeo.com");
      const el = await waitForElm(selectors.vimeoSelector);
      if (el) {
        await sleep(1000);
        await translateProccessor(
          document.querySelector(selectors.vimeoSelector),
          "vimeo",
          null
        );
      }
    } else if (window.location.hostname.includes("9gag.com")) {
      await sleep(1000);
      await translateProccessor(
        document.querySelector(selectors.gagSelector),
        "9gag",
        null
      );
    } else if (window.location.hostname.includes("rutube.ru")) {
      const elementSelector = window.location.pathname.includes("/play/embed")
        ? "#app > div > div"
        : ".video-player > div > div > div:nth-child(2)";

      const el = await waitForElm(elementSelector);
      if (el) {
        await translateProccessor(el, "rutube", null);
      }
    } else if (window.location.hostname.includes("bilibili.com")) {
      if (window.location.pathname.includes("/video/")) {
        const el = await waitForElm(selectors.bilibilicomSelector);
        if (el) {
          await translateProccessor(el, "bilibili.com", null);
        }
      } else if (
        window.location.pathname.includes(
          "/blackboard/webplayer/embed-old.html"
        )
      ) {
        const el = await waitForElm("video");
        if (el) {
          await translateProccessor(el.parentElement, "bilibili.com", null);
        }
      }
    } else if (window.location.hostname.includes("twitter.com")) {
      const el = await waitForElm(selectors.twitterSelector);
      if (el) {
        let videoIDNew;
        let videoID = getVideoId("twitter");
        await translateProccessor(el, "twitter", null);
        setInterval(async () => {
          videoIDNew = getVideoId("twitter");
          if (videoID !== videoIDNew) {
            if (videoIDNew) {
              await translateProccessor(
                document.querySelector(selectors.twitterSelector),
                "twitter",
                null
              );
            }
            videoID = videoIDNew;
          }
        }, 3000);
      }
    } else if (window.location.hostname.includes("my.mail.ru")) {
      const el = await waitForElm(selectors.mailSelector);
      if (el) {
        let videoIDNew;
        let videoID = getVideoId("mail.ru");
        await translateProccessor(el, "mail.ru", null);
        setInterval(async () => {
          videoIDNew = getVideoId("mail.ru");
          if (videoID !== videoIDNew) {
            if (videoIDNew) {
              await translateProccessor(
                document.querySelector(selectors.mailSelector),
                "mail.ru",
                null
              );
            }
            videoID = videoIDNew;
          }
        }, 3000);
      }
    }
  }

  await initWebsite();
}

main().catch((e) => {
  console.error(e);
});
