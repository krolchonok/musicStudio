let player;
let progressInterval;
let bassBoostFilter;
let isPlaying = false;
let currentPosition = 0;
let nameFile = "";
let baseName = "";
const inputFile = document.getElementById("fileInput");
const uploadLabel = document.querySelector(".upload-label");
const loaderContainer = document.querySelector(".loader-container");
const saveButton = document.getElementById("saveButton");
const themeToggle = document.getElementById("themeToggle");
const progressSlider = document.getElementById("progressControl");

// Инициализация темы
const initTheme = () => {
  // Проверяем сохраненную тему или системные настройки
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.body.setAttribute('data-theme', 'dark');
    themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
  } else {
    document.body.removeAttribute('data-theme');
    themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
  }
};

// Переключение темы
themeToggle.addEventListener('click', () => {
  if (document.body.getAttribute('data-theme') === 'dark') {
    document.body.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
    themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
  } else {
    document.body.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
  }
});

// Инициализируем тему при загрузке
initTheme();

// Обновление прогресс-бара (визуальный эффект заполнения)
const updateProgressBar = () => {
  const value = progressSlider.value;
  const percentage = value + '%';
  progressSlider.style.background = `linear-gradient(to right, var(--slider-fill) 0%, var(--slider-fill) ${percentage}, var(--slider-bg) ${percentage}, var(--slider-bg) 100%)`;
};

// Обновляем прогресс-бар при изменении значения
progressSlider.addEventListener('input', updateProgressBar);

saveButton.addEventListener("click", async function () {
  if (!player || !player.buffer) return;

  // Показываем анимацию загрузки внутри кнопки
  const originalContent = saveButton.innerHTML;
  saveButton.innerHTML = '<span class="loader"></span>';
  saveButton.disabled = true;

  try {
    const speedValue = parseFloat(document.getElementById("speedControl").value);
    const duration = player.buffer.duration / speedValue;

    const renderedBuffer = await Tone.Offline(() => {
      const offlinePlayer = new Tone.Player(player.buffer).toDestination();
      offlinePlayer.playbackRate = speedValue;
      offlinePlayer.start(0);
    }, duration);

    const mp3Blob = await convertToMp3(renderedBuffer);

    // Возвращаем оригинальное отображение кнопки
    saveButton.innerHTML = originalContent;
    saveButton.disabled = false;

    const url = URL.createObjectURL(mp3Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}_${speedValue}x.mp3`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Ошибка сохранения файла:", error);
    saveButton.innerHTML = originalContent;
    saveButton.disabled = false;
    alert("Не удалось сохранить файл. Пожалуйста, попробуйте еще раз.");
  }
});

async function convertToMp3(audioBuffer) {
  if (typeof lamejs === "undefined") {
    console.error(
      "Библиотека lamejs не загружена. Пожалуйста, добавьте ее в ваш проект."
    );
    return null;
  }

  const sampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;
  const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, 128);
  const mp3Data = [];

  const samples = new Int16Array(1152);
  const left = audioBuffer.getChannelData(0);
  const right = numChannels > 1 ? audioBuffer.getChannelData(1) : null;

  for (let i = 0; i < left.length; i += 1152) {
    for (let j = 0; j < 1152 && i + j < left.length; j++) {
      samples[j] =
        left[i + j] < 0 ? left[i + j] * 0x8000 : left[i + j] * 0x7fff;
    }

    let mp3buf;
    if (numChannels === 1) {
      mp3buf = mp3encoder.encodeBuffer(samples);
    } else {
      const rightSamples = new Int16Array(1152);
      for (let j = 0; j < 1152 && i + j < right.length; j++) {
        rightSamples[j] =
          right[i + j] < 0 ? right[i + j] * 0x8000 : right[i + j] * 0x7fff;
      }
      mp3buf = mp3encoder.encodeBuffer(samples, rightSamples);
    }

    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  }

  const finalizeBuf = mp3encoder.flush();
  if (finalizeBuf.length > 0) {
    mp3Data.push(finalizeBuf);
  }

  const totalLength = mp3Data.reduce((acc, buf) => acc + buf.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of mp3Data) {
    result.set(buf, offset);
    offset += buf.length;
  }

  return new Blob([result], { type: "audio/mp3" });
}

inputFile.addEventListener("change", async function (event) {
  const file = event.target.files[0];
  if (!file) return;

  nameFile = file.name;
  baseName = nameFile.split(".").slice(0, -1).join(".");

  // Обновляем UI
  uploadLabel.classList.add("hidden");
  loaderContainer.classList.remove("hidden");
  document.getElementById("controls").classList.add("hidden");

  resetPlayer();

  try {
    await Tone.start();

    const reader = new FileReader();

    reader.onload = function (e) {
      if (player) {
        player.stop();
        player.dispose();
      }

      // Сбрасываем все элементы управления
      document.getElementById("playPause").innerHTML = '<i class="fa-solid fa-play"></i>';
      progressSlider.value = 0;
      updateProgressBar(); // Обновляем стиль прогресс-бара
      document.getElementById("progressTime").textContent = "0:00";
      document.getElementById("durationTime").textContent = "0:00";
      document.getElementById("speedControl").value = 1;
      document.getElementById("speedValue").textContent = "1";
      document.getElementById("bassBoostControl").value = 0;
      document.getElementById("bassBoostValue").textContent = "0";
      document.getElementById("volumeControl").value = 0;
      document.getElementById("volumeValue").textContent = "0";
      currentPosition = 0;

      // Настраиваем эффекты
      bassBoostFilter = new Tone.Filter({
        type: "lowshelf",
        frequency: 250,
        gain: 0,
      }).toDestination();

      // Создаем плеер
      player = new Tone.Player({
        url: e.target.result,
        onload: () => {
          // Обновляем интерфейс когда файл загружен
          uploadLabel.classList.remove("hidden");
          loaderContainer.classList.add("hidden");
          document.getElementById("controls").classList.remove("hidden");
          document.getElementById("name").textContent = nameFile;
          document.getElementById("name").classList.remove("hidden");
          document.getElementById("durationTime").textContent = formatTime(player.buffer.duration);

          // Подключаем эффекты
          player.connect(bassBoostFilter);
          isPlaying = false;
        },
        onerror: (error) => {
          console.error("Ошибка загрузки:", error);
          alert("Ошибка при загрузке файла. Пожалуйста, выберите другой файл.");
          resetPlayer();
          uploadLabel.classList.remove("hidden");
          loaderContainer.classList.add("hidden");
        },
      });
    };

    reader.onerror = function (error) {
      console.error("Ошибка чтения файла:", error);
      alert("Ошибка при чтении файла. Пожалуйста, выберите другой файл.");
      resetPlayer();
      uploadLabel.classList.remove("hidden");
      loaderContainer.classList.add("hidden");
    };

    reader.readAsDataURL(file);
  } catch (error) {
    console.error("Ошибка инициализации аудио:", error);
    alert("Ошибка инициализации аудио. Пожалуйста, попробуйте еще раз.");
    resetPlayer();
    uploadLabel.classList.remove("hidden");
    loaderContainer.classList.add("hidden");
  }
});

function resetPlayer() {
  if (player) {
    player.stop();
    player.dispose();
    clearInterval(progressInterval);
  }
  isPlaying = false;
  currentPosition = 0;
  document.getElementById("controls").classList.add("hidden");
  document.getElementById("playPause").innerHTML = '<i class="fa-solid fa-play"></i>';
  document.getElementById("name").classList.add("hidden");
  progressSlider.value = 0;
  updateProgressBar();
}

document.getElementById("playPause").addEventListener("click", function () {
  if (!player || !player.buffer) return;

  if (isPlaying) {
    clearInterval(progressInterval);
    const progressValue = parseFloat(progressSlider.value);
    currentPosition = (progressValue / 100) * player.buffer.duration;
    player.stop();
    isPlaying = false;
    this.innerHTML = '<i class="fa-solid fa-play"></i>';
  } else {
    player.start("+0.1", currentPosition);
    isPlaying = true;
    this.innerHTML = '<i class="fa-solid fa-pause"></i>';
    updateProgress();
  }
});

document.getElementById("speedControl").addEventListener("input", function () {
  if (player && player.buffer) {
    const speedValue = parseFloat(this.value);
    player.playbackRate = speedValue;
    document.getElementById("speedValue").textContent = speedValue.toFixed(2);

    if (isPlaying) {
      const progressValue = parseFloat(progressSlider.value);
      currentPosition = (progressValue / 100) * player.buffer.duration;

      player.stop();
      player.start("+0.1", currentPosition);
      updateProgress();
    }

    // Обновляем визуальный стиль ползунка
    this.style.background = `linear-gradient(to right, var(--slider-fill) 0%, var(--slider-fill) ${((speedValue - 0.5) / 1.5) * 100}%, var(--slider-bg) ${((speedValue - 0.5) / 1.5) * 100}%, var(--slider-bg) 100%)`;
  }
});

progressSlider.addEventListener("input", function () {
  if (player && player.buffer) {
    const newPosition = (this.value / 100) * player.buffer.duration;
    currentPosition = newPosition;
    document.getElementById("progressTime").textContent = formatTime(newPosition);
    updateProgressBar();

    if (isPlaying) {
      player.stop();
      player.start("+0.1", newPosition);
      updateProgress();
    }
  }
});

document.getElementById("bassBoostControl").addEventListener("input", function () {
  if (bassBoostFilter) {
    const value = parseInt(this.value);
    bassBoostFilter.gain.value = value;
    document.getElementById("bassBoostValue").textContent = value;

    // Обновляем визуальный стиль ползунка
    this.style.background = `linear-gradient(to right, var(--slider-fill) 0%, var(--slider-fill) ${value * 5}%, var(--slider-bg) ${value * 5}%, var(--slider-bg) 100%)`;
  }
});

document.getElementById("volumeControl").addEventListener("input", function () {
  if (player) {
    const value = parseInt(this.value);
    player.volume.value = value;
    document.getElementById("volumeValue").textContent = value;

    // Обновляем визуальный стиль ползунка
    const percentage = ((value + 50) / 90) * 100;
    this.style.background = `linear-gradient(to right, var(--slider-fill) 0%, var(--slider-fill) ${percentage}%, var(--slider-bg) ${percentage}%, var(--slider-bg) 100%)`;
  }
});

function updateProgress() {
  clearInterval(progressInterval);

  const startedAt = Date.now();
  const startPosition = currentPosition;
  const playbackRate = player.playbackRate;

  progressInterval = setInterval(() => {
    if (player && player.buffer && isPlaying) {
      try {
        const elapsedSinceStart = (Date.now() - startedAt) / 1000;
        const calculatedPosition =
          startPosition + elapsedSinceStart * playbackRate;
        const duration = player.buffer.duration;

        currentPosition = Math.min(calculatedPosition, duration);

        if (currentPosition >= duration) {
          player.stop();
          isPlaying = false;
          document.getElementById("playPause").innerHTML =
            '<i class="fa-solid fa-play"></i>';
          progressSlider.value = 100;
          updateProgressBar();
          document.getElementById("progressTime").textContent =
            formatTime(duration);
          currentPosition = 0;
          clearInterval(progressInterval);
          return;
        }

        const progress = (currentPosition / duration) * 100;
        progressSlider.value = progress;
        updateProgressBar();

        document.getElementById("progressTime").textContent =
          formatTime(currentPosition);
      } catch (error) {
        console.error("Ошибка обновления прогресса:", error);
        clearInterval(progressInterval);
      }
    }
  }, 100);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
}

// Инициализация визуальных стилей ползунков
window.addEventListener('DOMContentLoaded', () => {
  // Установка начальных визуальных стилей для ползунков
  const initSliders = () => {
    const speedControl = document.getElementById("speedControl");
    const bassBoostControl = document.getElementById("bassBoostControl");
    const volumeControl = document.getElementById("volumeControl");

    // Иницализируем визуальное отображение ползунков
    speedControl.style.background = `linear-gradient(to right, var(--slider-fill) 0%, var(--slider-fill) ${((1 - 0.5) / 1.5) * 100}%, var(--slider-bg) ${((1 - 0.5) / 1.5) * 100}%, var(--slider-bg) 100%)`;
    bassBoostControl.style.background = `linear-gradient(to right, var(--slider-fill) 0%, var(--slider-fill) 0%, var(--slider-bg) 0%, var(--slider-bg) 100%)`;
    volumeControl.style.background = `linear-gradient(to right, var(--slider-fill) 0%, var(--slider-fill) ${(50 / 90) * 100}%, var(--slider-bg) ${(50 / 90) * 100}%, var(--slider-bg) 100%)`;
    progressSlider.style.background = `linear-gradient(to right, var(--slider-fill) 0%, var(--slider-fill) 0%, var(--slider-bg) 0%, var(--slider-bg) 100%)`;
  };

  initSliders();
});