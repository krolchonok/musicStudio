let player;
let progressInterval;
let bassBoostFilter;
let isPlaying = false;
let currentPosition = 0;
let nameFile = "";
let baseName = "";
const inputFile = document.getElementById("fileInput");
const uploadLabel = document.querySelector(".upload-label");
const loader = document.querySelector(".loader");
const saveButton = document.getElementById("saveButton");

saveButton.addEventListener("click", async function () {
  if (!player || !player.buffer) return;
  saveButton.innerHTML = '<span class="loader"></span>';
  const speedValue = parseFloat(document.getElementById("speedControl").value);
  const duration = player.buffer.duration / speedValue;

  const renderedBuffer = await Tone.Offline(() => {
    const offlinePlayer = new Tone.Player(player.buffer).toDestination();
    offlinePlayer.playbackRate = speedValue;
    offlinePlayer.start(0);
  }, duration);

  const mp3Blob = await convertToMp3(renderedBuffer);
  saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>';
  const url = URL.createObjectURL(mp3Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${baseName}_${speedValue}x.mp3`;
  a.click();
  URL.revokeObjectURL(url);
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
  nameFile = file.name;
  baseName = nameFile.split(".").slice(0, -1).join(".");
  uploadLabel.classList.add("hidden");

  loader.classList.remove("hidden");
  if (file) {
    resetPlayer();

    document.getElementById("controls").classList.add("hidden");

    await Tone.start();

    const reader = new FileReader();
    reader.onload = function (e) {
      if (player) {
        player.stop();
        player.dispose();
      }

      document.getElementById("playPause").innerHTML =
        '<i class="fa-solid fa-play"></i>';
      document.getElementById("progressControl").value = 0;
      document.getElementById("progressTime").textContent = "0:00";
      document.getElementById("durationTime").textContent = "0:00";
      document.getElementById("speedControl").value = 1;
      document.getElementById("speedValue").textContent = "1";
      document.getElementById("bassBoostControl").value = 0;
      document.getElementById("volumeControl").value = 0;
      document.getElementById("bassBoostValue").textContent = "0";
      currentPosition = 0;

      bassBoostFilter = new Tone.Filter({
        type: "lowshelf",
        frequency: 250,
        gain: 0,
      }).toDestination();

      player = new Tone.Player({
        url: e.target.result,
        onload: () => {
          uploadLabel.classList.remove("hidden");
          loader.classList.add("hidden");

          document.getElementById("controls").classList.remove("hidden");

          document.getElementById("name").textContent = nameFile;
          document.getElementById("name").classList.remove("hidden");

          document.getElementById("durationTime").textContent = formatTime(
            player.buffer.duration
          );

          player.connect(bassBoostFilter);
          isPlaying = false;
        },
        onerror: (error) => {
          console.error("Ошибка загрузки:", error);
          alert("Ошибка при загрузке файла. Пожалуйста, выберите другой файл.");
          resetPlayer();
        },
      });
    };

    reader.onerror = function (error) {
      console.error("Ошибка чтения файла:", error);
      alert("Ошибка при чтении файла. Пожалуйста, выберите другой файл.");
      resetPlayer();
    };

    reader.readAsDataURL(file);
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
  document.getElementById("playPause").innerHTML =
    '<i class="fa-solid fa-play"></i>';
  document.getElementById("name").classList.add("hidden");
}

document.getElementById("playPause").addEventListener("click", function () {
  if (!player || !player.buffer) return;

  if (isPlaying) {
    clearInterval(progressInterval);
    const progressValue = parseFloat(
      document.getElementById("progressControl").value
    );
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
      const progressValue = parseFloat(
        document.getElementById("progressControl").value
      );
      currentPosition = (progressValue / 100) * player.buffer.duration;

      player.stop();
      player.start("+0.1", currentPosition);
      updateProgress();
    }
  }
});

document
  .getElementById("progressControl")
  .addEventListener("input", function () {
    if (player && player.buffer) {
      const newPosition = (this.value / 100) * player.buffer.duration;
      currentPosition = newPosition;
      document.getElementById("progressTime").textContent =
        formatTime(newPosition);

      if (isPlaying) {
        player.stop();
        player.start("+0.1", newPosition);
        updateProgress();
      }
    }
  });

document
  .getElementById("bassBoostControl")
  .addEventListener("input", function () {
    if (bassBoostFilter) {
      const value = parseInt(this.value);
      bassBoostFilter.gain.value = value;
      document.getElementById("bassBoostValue").textContent = value;
    }
  });

document.getElementById("volumeControl").addEventListener("input", function () {
  if (player) {
    const value = parseInt(this.value);
    player.volume.value = value;
    document.getElementById("volumeValue").textContent = value;
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
          document.getElementById("progressControl").value = 100;
          document.getElementById("progressTime").textContent =
            formatTime(duration);
          currentPosition = 0;
          clearInterval(progressInterval);
          return;
        }

        const progress = (currentPosition / duration) * 100;

        document.getElementById("progressControl").value = progress;

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
