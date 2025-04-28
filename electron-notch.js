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

notch.addEventListener('mouseenter', () => {
    ipcRenderer.send('toggle-mouse-events', false);
    notch.classList.add('expanded');
    setTimeout(checkLyricsOverflow, 300);
});

notch.addEventListener('mouseleave', () => {
    ipcRenderer.send('toggle-mouse-events', true);
    notch.classList.remove('expanded');
    setTimeout(checkLyricsOverflow, 300);
});

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

function fragmentMatchScore(audioName, lyricName) {
    const normalize = (name) => {
        return name
            .replace(/^\d+\s*[-_\.]?\s*/, '') // 移除数字前缀
            .replace(/\.mp3|\.flac|\.ogg|\.mp4|\.webm|\.lrc|\.srt$/i, '') // 移除扩展名
            .toLowerCase()
            .trim();
    };

    const normalizedAudio = normalize(audioName);
    const normalizedLyric = normalize(lyricName);

    // 完全匹配优先
    if (normalizedAudio === normalizedLyric) return 1.0;

    // 计算字符串相似度（Levenshtein 距离）
    const levenshteinDistance = (s1, s2) => {
        const len1 = s1.length, len2 = s2.length;
        const dp = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
        for (let i = 0; i <= len1; i++) dp[i][0] = i;
        for (let j = 0; j <= len2; j++) dp[0][j] = j;
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1, // 删除
                    dp[i][j - 1] + 1, // 插入
                    dp[i - 1][j - 1] + cost // 替换
                );
            }
        }
        return dp[len1][len2];
    };

    const distance = levenshteinDistance(normalizedAudio, normalizedLyric);
    const maxLength = Math.max(normalizedAudio.length, normalizedLyric.length);
    const similarity = 1 - distance / maxLength;

    // 额外加分：如果音频名包含歌词名或反之
    let bonus = 0;
    if (normalizedAudio.includes(normalizedLyric) || normalizedLyric.includes(normalizedAudio)) {
        bonus += 0.3;
    }

    return similarity + bonus;
}

function containsChinese(str) {
    return /[\u4E00-\u9FFF]/.test(str);
}

function findBestMatchingLrc(audioPath, lyricFiles, albumPath) {
    const audioName = audioPath.split('/').pop().replace(/\.mp3|\.flac|\.ogg|\.mp4|\.webm$/i, '');
    const isAudioChinese = containsChinese(audioName);

    const matches = lyricFiles
        .filter(lyricPath => lyricPath.split('/').slice(0, -1).join('/') === albumPath)
        .map(lyricPath => {
            const lyricName = lyricPath.split('/').pop().replace(/\.lrc|\.srt$/i, '');
            const score = fragmentMatchScore(audioName, lyricName);
            const isLyricChinese = containsChinese(lyricName);
            // 如果音频名是中文，优先匹配中文歌词文件
            const languageBonus = (isAudioChinese && isLyricChinese) ? 0.2 : 0;
            return { lyricPath, score: score + languageBonus, isSrt: lyricPath.toLowerCase().endsWith('.srt') };
        })
        .filter(match => match.score >= 0.6);

    if (!matches.length) {
        console.warn(`No matching lyric file found for ${audioPath}`);
        return null;
    }

    const normalizedAudio = audioName.replace(/^\d+\s*[-_\.]?\s*/, '').toLowerCase();
    const exactMatch = matches.find(match => {
        const normalizedLyric = match.lyricPath.split('/').pop().replace(/\.lrc|\.srt$/i, '')
            .replace(/^\d+\s*[-_\.]?\s*/, '').toLowerCase();
        return normalizedAudio === normalizedLyric;
    });

    if (exactMatch) return exactMatch.lyricPath;

    const bestMatch = matches.reduce((best, current) => {
        if (best.score === current.score) {
            return current.isSrt ? best : current;
        }
        return current.score > best.score ? current : best;
    }, matches[0]);

    console.log(`Matched ${audioPath} with ${bestMatch.lyricPath} (score: ${bestMatch.score})`);
    return bestMatch.lyricPath;
}

async function processFiles(files) {
    const audioFiles = Array.from(files).filter(file =>
        file.type === "audio/mpeg" || file.type === "audio/flac" || file.type === "audio/ogg"
    );
    const lyricFiles = Array.from(files).filter(file =>
        file.name.toLowerCase().endsWith(".lrc") || file.name.toLowerCase().endsWith(".srt")
    );
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
    allLrcFiles = lyricFiles.map(file => file.webkitRelativePath || file.name);

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
            notchTime.innerHTML = `<span class="current-time">0:00</span><span class="total-time">${formatTime(audioPlayer.duration)}</span>`;
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
        const lyricFile = fileArray.find(f => (f?.webkitRelativePath || f?.name) === bestMatch);
        if (lyricFile) {
            const reader = new FileReader();
            return new Promise((resolve) => {
                reader.onload = (e) => {
                    const isSrt = bestMatch.toLowerCase().endsWith('.srt');
                    lyrics = isSrt ? parseSrt(e.target.result) : parseLrc(e.target.result);
                    updateNotchLyrics();
                    resolve();
                };
                reader.onerror = () => {
                    lyrics = [];
                    notchLyrics.textContent = "无法加载歌词文件";
                    updateNotchLyrics();
                    resolve();
                };
                reader.readAsText(lyricFile);
            });
        }
    }
    lyrics = [];
    notchLyrics.textContent = "暂无歌词";
    updateNotchLyrics();
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

function parseSrt(srtContent) {
    const lines = srtContent.trim().split('\n\n').filter(Boolean);
    const srtArray = [];
    const timeRegex = /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/;

    lines.forEach(block => {
        const [index, timeLine, ...textLines] = block.split('\n');
        const match = timeLine.match(timeRegex);
        if (match) {
            const startTime = parseSrtTime(match[1]);
            const text = textLines.join(' ').trim();
            if (text) srtArray.push({ time: startTime, text });
        }
    });

    return srtArray;
}

function parseSrtTime(timeStr) {
    const [hours, minutes, seconds] = timeStr.split(':');
    const [secs, millis] = seconds.split(',');
    return parseInt(hours, 10) * 3600 +
        parseInt(minutes, 10) * 60 +
        parseInt(secs, 10) +
        parseInt(millis, 10) / 1000;
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

audioPlayer.addEventListener("ended", () => {
    playNextSong();
});

function resetPlaybackUI() {
    notchProgress.style.width = '0%';
    notchTime.innerHTML = `<span class="current-time">0:00</span><span class="total-time">${formatTime(audioPlayer.duration || 0)}</span>`;
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
            resetPlaybackUI();
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