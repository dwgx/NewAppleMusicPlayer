const { ipcRenderer } = require('electron');

const audioFileInput = document.querySelector('.audiofile');
const audioPlayer = document.querySelector('.player');
const notch = document.getElementById('notch');
const notchProgressContainer = document.querySelector('#notch .progress-container');
const notchProgress = document.querySelector('.notch-progress');
const notchTime = document.querySelector('.notch-time');
const notchPlay = document.querySelector('.notch-play');
const notchPause = document.querySelector('.notch-pause');
const notchPrev = document.querySelector('.notch-prev');
const notchNext = document.querySelector('.notch-next');
const notchAlbumArt = document.querySelector('.album-art');
const notchTitle = document.querySelector('.notch-title');
const notchLyrics = document.querySelector('.notch-lyrics');
const notchVolumeBar = document.querySelector('.notch-volume-bar');
const notchVolumeProcess = document.querySelector('.notch-volume-process');
const waveformBars = document.querySelectorAll('#notch .waveform span');

let playing = false;
let activeDragBar = null;
let currentFile = null;
let fileArray = [];
let playlistData = [];
let allLrcFiles = [];
let lyrics = [];
let audioContext, analyser, dataArray;
let lastUpdateTime = 0;
let playbackMode = localStorage.getItem('playbackMode') || 'loop';

function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

function formatTime(seconds) {
    if (Number.isNaN(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

function setupAudioAnalysis() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaElementSource(audioPlayer);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        analyser.fftSize = 512;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
    } catch (error) {
        console.error("音频分析初始化失败：", error);
    }
}

notchAlbumArt.addEventListener("click", () => audioFileInput.click());

audioFileInput.addEventListener("change", async (event) => {
    const files = event.target.files;
    if (!files.length) {
        notchTitle.textContent = "未选择文件";
        notchLyrics.textContent = "";
        return;
    }
    try {
        fileArray = Array.from(files);
        await processFiles(files);
        setupAudioAnalysis();
    } catch (error) {
        console.error("文件加载失败：", error);
        notchTitle.textContent = "加载失败";
        notchLyrics.textContent = "";
    }
});

function fragmentMatchScore(audioName, lrcName) {
    const audioFragments = audioName.toLowerCase().split(/[-_\s()]+/).filter(Boolean);
    const lrcFragments = lrcName.toLowerCase().split(/[-_\s()]+/).filter(Boolean);
    let score = 0;
    const minLength = Math.min(audioFragments.length, lrcFragments.length);
    for (let i = 0; i < minLength; i++) {
        if (audioFragments[i] === lrcFragments[i]) score += 1;
        else if (audioFragments[i].includes(lrcFragments[i]) || lrcFragments[i].includes(audioFragments[i])) score += 0.5;
    }
    const overlap = audioFragments.filter(af => lrcFragments.some(lf => lf.includes(af) || af.includes(lf))).length;
    score += overlap * 0.3;
    return score / (Math.max(audioFragments.length, lrcFragments.length) || 1);
}

function findBestMatchingLrc(audioPath, lrcFiles, albumPath) {
    const audioName = audioPath.split('/').pop().replace(/\.mp3|\.flac|\.ogg$/i, '');
    const matches = lrcFiles
        .filter(lrcPath => lrcPath.split('/').slice(0, -1).join('/') === albumPath)
        .map(lrcPath => {
            const lrcName = lrcPath.split('/').pop().replace(/\.lrc$/i, '');
            return { lrcPath, score: fragmentMatchScore(audioName, lrcName) };
        })
        .filter(match => match.score > 0.5);
    return matches.length ? matches.reduce((best, current) => current.score > best.score ? current : best).lrcPath : null;
}

async function processFiles(files) {
    const audioFiles = Array.from(files).filter(file =>
        file.type === "audio/mpeg" || file.type === "audio/flac" || file.type === "audio/ogg"
    );
    const lrcFiles = Array.from(files).filter(file => file.name.toLowerCase().endsWith(".lrc"));
    const imageFiles = Array.from(files).filter(file => file.type.startsWith("image/"));
    const albumMap = {};

    audioFiles.forEach(file => {
        const path = file.webkitRelativePath || file.name;
        const albumPath = path.split('/').slice(0, -1).join('/');
        if (!albumMap[albumPath]) albumMap[albumPath] = { songs: [], cover: null };
        albumMap[albumPath].songs.push(file);
    });

    imageFiles.forEach(image => {
        const path = image.webkitRelativePath || image.name;
        const albumPath = path.split('/').slice(0, -1).join('/');
        if (albumMap[albumPath]) albumMap[albumPath].cover = image;
    });

    const albums = Object.keys(albumMap).map(albumPath => ({
        name: albumPath,
        songs: albumMap[albumPath].songs,
        cover: albumMap[albumPath].cover
    }));

    playlistData = albums.flatMap(album => album.songs.map(file => ({
        file,
        name: (file.webkitRelativePath || file.name).split('/').pop(),
        cover: album.cover
    })));
    allLrcFiles = lrcFiles.map(file => file.webkitRelativePath || file.name);

    if (audioFiles.length) {
        await processSingleFile(playlistData[0].file, URL.createObjectURL(playlistData[0].file), true, playlistData[0].cover);
    }
}

async function processSingleFile(file, src, autoPlay = false, cover = null) {
    try {
        currentFile = { file, src, cover };
        audioPlayer.src = src;
        audioPlayer.currentTime = 0;
        resetPlaybackUI();

        let filename = file.name.split('.')[0];
        notchTitle.textContent = filename;
        notchTime.innerHTML = `<span class="current-time">0:00</span><span class="total-time">${formatTime(audioPlayer.duration || 0)}</span>`;

        if (cover) {
            const coverSrc = URL.createObjectURL(cover);
            notchAlbumArt.classList.remove('flip');
            notchAlbumArt.style.backgroundImage = `url(${coverSrc})`;
            void notchAlbumArt.offsetWidth;
            notchAlbumArt.classList.add('flip');
            updateWaveformColors(coverSrc);
        } else {
            notchAlbumArt.style.backgroundImage = "";
            applyWaveformGradient(['#fff']);
        }

        await loadMatchingLrc(file.webkitRelativePath || file.name);
        checkLyricsOverflow();

        audioPlayer.addEventListener('loadedmetadata', () => {
            if (autoPlay) togglePlayPause(true);
        }, { once: true });
    } catch (error) {
        console.error("处理音频文件失败：", error);
        notchTitle.textContent = "加载失败，请检查文件格式";
        notchLyrics.textContent = "";
    }
}

async function loadMatchingLrc(path) {
    const albumPath = path.split('/').slice(0, -1).join('/');
    const bestMatch = findBestMatchingLrc(path, allLrcFiles, albumPath);
    if (bestMatch) {
        const lrcFile = fileArray.find(f => (f?.webkitRelativePath || f?.name) === bestMatch);
        if (lrcFile) {
            const reader = new FileReader();
            return new Promise((resolve) => {
                reader.onload = (e) => {
                    lyrics = parseLrc(e.target.result);
                    updateNotchLyrics();
                    resolve();
                };
                reader.readAsText(lrcFile);
            });
        }
    } else {
        lyrics = [];
        notchLyrics.textContent = "暂无歌词";
    }
}

function parseLrc(lrcContent) {
    const lines = lrcContent.trim().split('\n');
    const lrcArray = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
    lines.forEach((line) => {
        const match = line.match(timeRegex);
        if (match) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const milliseconds = match[3].length === 2 ? parseInt(match[3], 10) * 10 : parseInt(match[3], 10);
            const time = minutes * 60 + seconds + milliseconds / 1000;
            const text = line.replace(timeRegex, '').trim();
            if (text) lrcArray.push({ time, text });
        }
    });
    return lrcArray;
}

audioPlayer.addEventListener("loadedmetadata", () => {
    const savedVolume = localStorage.getItem('volume') || 1;
    notchVolumeProcess.style.width = `${savedVolume * 100}%`;
    audioPlayer.volume = savedVolume;
});

audioPlayer.addEventListener("timeupdate", throttle(() => {
    if (!audioPlayer.duration) return;
    const percentage = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    notchProgress.style.width = `${percentage}%`;
    notchTime.innerHTML = `<span class="current-time">${formatTime(audioPlayer.currentTime)}</span><span class="total-time">${formatTime(audioPlayer.duration)}</span>`;
    if (playing) {
        requestAnimationFrame(updateWaveform);
        updateNotchLyrics();
    }
}, 100));

audioPlayer.addEventListener("ended", playNextSong);

function resetPlaybackUI() {
    notchProgress.style.width = '0%';
    notchTime.textContent = `0:00 / ${formatTime(audioPlayer.duration || 0)}`;
    notchPlay.style.display = 'inline';
    notchPause.style.display = 'none';
    notch.classList.remove('playing');
    notch.classList.add('paused');
    playing = false;
}

function togglePlayPause(isPlaying) {
    if (isPlaying === playing) return;
    playing = isPlaying;

    if (isPlaying) {
        audioPlayer.play().then(() => {
            notchPlay.style.display = "none";
            notchPause.style.display = "inline";
            notch.classList.remove('paused');
            notch.classList.add('playing');
        }).catch(error => {
            console.error("播放失败：", error);
            playing = false;
        });
    } else {
        audioPlayer.pause();
        notchPlay.style.display = "inline";
        notchPause.style.display = "none";
        notch.classList.remove('playing');
        notch.classList.add('paused');
    }
}

notchPlay.addEventListener("click", () => togglePlayPause(true));
notchPause.addEventListener("click", () => togglePlayPause(false));
notchNext.addEventListener("click", playNextSong);
notchPrev.addEventListener("click", playPrevSong);

const throttledMouseMove = throttle((event) => {
    if (activeDragBar === 'notchProgress') updateNotchProgress(event);
    else if (activeDragBar === 'notchVolume') updateNotchVolume(event);
}, 16);

notchProgressContainer.addEventListener("mousedown", (event) => {
    activeDragBar = 'notchProgress';
    updateNotchProgress(event);
});
notchVolumeBar.addEventListener("mousedown", (event) => {
    activeDragBar = 'notchVolume';
    updateNotchVolume(event);
});

document.addEventListener("mousemove", throttledMouseMove);
document.addEventListener("mouseup", () => activeDragBar = null);

notch.addEventListener('mouseenter', () => {
    notch.classList.add('expanded');
    setTimeout(checkLyricsOverflow, 300);
});
notch.addEventListener('mouseleave', () => {
    notch.classList.remove('expanded');
    setTimeout(checkLyricsOverflow, 300);
});

function updateNotchProgress(event) {
    if (Number.isNaN(audioPlayer.duration)) return;
    const rect = notchProgressContainer.getBoundingClientRect();
    const percentage = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    notchProgress.style.width = `${percentage * 100}%`;
    audioPlayer.currentTime = percentage * audioPlayer.duration;
}

function updateNotchVolume(event) {
    const rect = notchVolumeBar.getBoundingClientRect();
    const percentage = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    notchVolumeProcess.style.width = `${percentage * 100}%`;
    audioPlayer.volume = percentage;
    localStorage.setItem('volume', percentage);
}

function playNextSong() {
    if (!playlistData.length) return;
    let currentIndex = playlistData.findIndex(item => item.file === currentFile?.file);
    if (currentIndex === -1) currentIndex = 0;

    let nextIndex;
    switch (playbackMode) {
        case 'sequential':
            nextIndex = currentIndex + 1;
            if (nextIndex >= playlistData.length) {
                togglePlayPause(false);
                audioPlayer.currentTime = 0;
                resetPlaybackUI();
                return;
            }
            break;
        case 'reverse':
            nextIndex = currentIndex - 1;
            if (nextIndex < 0) {
                togglePlayPause(false);
                audioPlayer.currentTime = 0;
                resetPlaybackUI();
                return;
            }
            break;
        case 'loop':
            nextIndex = (currentIndex + 1) % playlistData.length;
            break;
        case 'random':
            nextIndex = Math.floor(Math.random() * playlistData.length);
            while (nextIndex === currentIndex && playlistData.length > 1) {
                nextIndex = Math.floor(Math.random() * playlistData.length);
            }
            break;
        default:
            nextIndex = (currentIndex + 1) % playlistData.length;
    }

    const nextFile = playlistData[nextIndex];
    if (nextFile) {
        audioPlayer.pause();
        resetPlaybackUI();
        processSingleFile(nextFile.file, URL.createObjectURL(nextFile.file), true, nextFile.cover);
    }
}

function playPrevSong() {
    if (!playlistData.length) return;
    let currentIndex = playlistData.findIndex(item => item.file === currentFile?.file);
    if (currentIndex === -1) return;

    let prevIndex;
    switch (playbackMode) {
        case 'sequential':
            prevIndex = currentIndex - 1;
            if (prevIndex < 0) return;
            break;
        case 'reverse':
            prevIndex = currentIndex + 1;
            if (prevIndex >= playlistData.length) return;
            break;
        case 'loop':
            prevIndex = (currentIndex - 1 + playlistData.length) % playlistData.length;
            break;
        case 'random':
            prevIndex = Math.floor(Math.random() * playlistData.length);
            while (prevIndex === currentIndex && playlistData.length > 1) {
                prevIndex = Math.floor(Math.random() * playlistData.length);
            }
            break;
        default:
            prevIndex = (currentIndex - 1 + playlistData.length) % playlistData.length;
    }

    const prevFile = playlistData[prevIndex];
    if (prevFile) {
        audioPlayer.pause();
        resetPlaybackUI();
        processSingleFile(prevFile.file, URL.createObjectURL(prevFile.file), true, prevFile.cover);
    }
}

function updateWaveform() {
    if (!analyser || !dataArray || !playing) {
        waveformBars.forEach(bar => bar.style.transform = 'scaleY(0.2)');
        return;
    }

    analyser.getByteTimeDomainData(dataArray);
    const barCount = 6;
    const step = Math.floor(dataArray.length / barCount);

    waveformBars.forEach((bar, i) => {
        const start = i * step;
        const end = start + step;
        let sum = 0;
        let peak = 0;

        for (let j = start; j < end; j++) {
            const value = (dataArray[j] - 128) / 128;
            sum += Math.abs(value);
            peak = Math.max(peak, Math.abs(value));
        }

        const avgAmplitude = sum / step;
        const scale = Math.max(0.2, Math.min(3.0, (avgAmplitude * 3 + peak) * 2));
        const currentScale = parseFloat(bar.style.transform.match(/scaleY\((.*?)\)/)?.[1] || 0.2);
        const newScale = currentScale * 0.7 + scale * 0.3;

        bar.style.transform = `scaleY(${newScale})`;
    });

    if (playing) requestAnimationFrame(updateWaveform);
}

function updateWaveformColors(imageSrc) {
    if (!imageSrc) {
        applyWaveformGradient(['#fff']);
        return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 100;
        canvas.height = 100;
        ctx.drawImage(img, 0, 0, 100, 100);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const colors = extractColors(imageData.data);
        applyWaveformGradient(colors.map(c => `rgb(${c.join(',')})`));
    };
    img.src = imageSrc;
}

function applyWaveformGradient(colors) {
    const gradient = `linear-gradient(90deg, ${colors.join(', ')})`;
    waveformBars.forEach(bar => bar.style.background = gradient);
}

function extractColors(data) {
    const colorCount = {};
    for (let i = 0; i < data.length; i += 4) {
        const r = Math.round(data[i] / 51) * 51;
        const g = Math.round(data[i + 1] / 51) * 51;
        const b = Math.round(data[i + 2] / 51) * 51;
        const key = `${r},${g},${b}`;
        colorCount[key] = (colorCount[key] || 0) + 1;
    }

    const sortedColors = Object.entries(colorCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([key]) => key.split(',').map(Number));

    while (sortedColors.length < 5) sortedColors.push([255, 255, 255]);
    return sortedColors;
}

function updateNotchLyrics() {
    if (!lyrics.length) {
        notchLyrics.textContent = "暂无歌词";
        checkLyricsOverflow();
        return;
    }

    const currentTime = audioPlayer.currentTime;
    const activeIndex = lyrics.findIndex(lyric => lyric.time > currentTime) - 1;
    if (activeIndex >= 0 && activeIndex < lyrics.length) {
        notchLyrics.textContent = lyrics[activeIndex].text;
        checkLyricsOverflow();
    } else if (activeIndex < 0 && lyrics[0].time > currentTime) {
        notchLyrics.textContent = "";
        checkLyricsOverflow();
    }
}

function checkLyricsOverflow() {
    const title = notchTitle;
    const lyrics = notchLyrics;
    const isExpanded = notch.classList.contains('expanded');

    const titleWidth = title.scrollWidth;
    const titleContainerWidth = isExpanded ? title.parentElement.clientWidth - 20 : 120;
    if (titleWidth > titleContainerWidth) {
        title.classList.add('marquee');
        const titleDuration = Math.max(8, titleWidth / 30);
        title.style.animationDuration = `${titleDuration}s`;
    } else {
        title.classList.remove('marquee');
    }

    const lyricsWidth = lyrics.scrollWidth;
    const lyricsContainerWidth = isExpanded ? lyrics.parentElement.clientWidth - 20 : 120;
    if (lyricsWidth > lyricsContainerWidth) {
        lyrics.classList.add('marquee');
        const lyricsDuration = Math.max(10, lyricsWidth / 25);
        lyrics.style.animationDuration = `${lyricsDuration}s`;
    } else {
        lyrics.classList.remove('marquee');
    }
}

window.addEventListener('load', () => {
    playbackMode = localStorage.getItem('playbackMode') || 'loop';
});