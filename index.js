const svgcontainer = document.querySelector('.svgcontainer');
const audioFileInput = document.querySelector('.audiofile');
const audioPlayer = document.querySelector('.player');
const playlistItems = document.querySelector('.playlist-items');
const playlist = document.querySelector('.playlist');
const playlistToggle = document.querySelector('.playlist-toggle');
const closePlaylist = document.querySelector('.close-playlist');
const searchBar = document.querySelector('.search-bar');
const lyricsElement = document.querySelector('.lyrics');
const justSvg = document.querySelector('.svg');
const progressBar = document.querySelector('.processbar');
const progress = document.querySelector('.progress');
const volumeBar = document.querySelector('.volume-bar');
const volumeProcess = document.querySelector('.volume-process');
const speedBar = document.querySelector('.speed-bar');
const speedProcess = document.querySelector('.speed-process');
const startTime = document.querySelector('.start');
const endTime = document.querySelector('.end');
const audioName = document.querySelector('.name');
const playBtn = document.querySelector('.play-pause');
const prevBtn = document.querySelector('.prev');
const nextBtn = document.querySelector('.next');
const playIcon = document.querySelector('.play');
const pauseIcon = document.querySelector('.pause');
const volumeValue = document.querySelector('.volume-value');
const speedValue = document.querySelector('.speed-value');
const infoModal = document.getElementById('info-modal');
const songInfo = document.getElementById('song-info');
const closeInfoBtn = document.getElementById('close-info');
const infoBtn = document.querySelector('.info-btn');
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

let playbackMode = localStorage.getItem('playbackMode') || 'loop';
let playlistData = [];
let albums = [];
let allLrcFiles = [];
let lyrics = [];
let playing = false;
let activeDragBar = null;
let currentFile = null;
let fileArray = [];
let audioContext, analyser, dataArray;
let lastUpdateTime = 0;

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

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
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

svgcontainer.addEventListener("click", () => audioFileInput.click());

audioFileInput.addEventListener("change", async (event) => {
    console.log("Files selected:", event.target.files); // 添加日志
    const files = event.target.files;
    if (!files.length) {
        notchTitle.textContent = "未选择文件";
        return;
    }
    try {
        fileArray = Array.from(files);
        await processFolder(files);
        setupAudioAnalysis();
    } catch (error) {
        console.error("文件加载失败：", error);
        notchTitle.textContent = "加载失败";
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

async function processFolder(files) {
    const audioFiles = Array.from(files).filter(file =>
        file.type === "audio/mpeg" ||
        file.type === "audio/flac" ||
        file.type === "audio/ogg" // 添加 OGG 支持
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

    albums = Object.keys(albumMap).map(albumPath => ({
        name: albumPath,
        songs: albumMap[albumPath].songs,
        cover: albumMap[albumPath].cover
    }));

    playlistData = albums.flatMap(album => album.songs.map(file => ({
        file,
        name: (file.webkitRelativePath || file.name).split('/').pop()
    })));
    allLrcFiles = lrcFiles.map(file => file.webkitRelativePath || file.name);

    updatePlaylist();
    if (audioFiles.length) await processSingleFile(audioFiles[0], URL.createObjectURL(audioFiles[0]), true);
}

async function processSingleFile(file, src, autoPlay = false) {
    try {
        currentFile = { file, src };
        audioPlayer.src = src;
        audioPlayer.currentTime = 0;
        resetPlaybackUI();

        let filename = currentFile.file ? (currentFile.file.webkitRelativePath || currentFile.file.name).split('/').pop().split('.')[0] : "未知文件";
        audioName.textContent = filename;
        notchTitle.textContent = filename;
        notchTime.innerHTML = `<span class="current-time">0:00</span><span class="total-time">${formatTime(audioPlayer.duration || 0)}</span>`;

        const album = albums.find(a => a.songs.some(s => s === currentFile.file));
        const cover = album?.cover;
        if (cover) {
            const coverSrc = URL.createObjectURL(cover);
            svgcontainer.style.backgroundImage = `url(${coverSrc})`;
            svgcontainer.style.backgroundSize = "cover";
            svgcontainer.style.backgroundPosition = "center";
            notchAlbumArt.classList.remove('flip');
            notchAlbumArt.style.backgroundImage = `url(${coverSrc})`;
            void notchAlbumArt.offsetWidth;
            notchAlbumArt.classList.add('flip');
            justSvg.style.opacity = "0";
            updateBackground(coverSrc);
        } else {
            svgcontainer.style.backgroundImage = "none";
            svgcontainer.style.backgroundColor = "#e8e8e8";
            notchAlbumArt.classList.remove('flip');
            notchAlbumArt.style.backgroundImage = "";
            justSvg.style.opacity = "1";
            updateBackground(null);
        }

        await loadMatchingLrc(currentFile.file ? (currentFile.file.webkitRelativePath || currentFile.file.name) : src);
        await loadSongInfo(currentFile.file);
        highlightCurrentSong();
        checkTitleOverflow();

        audioPlayer.addEventListener('loadedmetadata', () => {
            if (autoPlay) togglePlayPause(true);
        }, { once: true });
    } catch (error) {
        console.error("处理音频文件失败：", error);
        audioName.textContent = "加载失败，请检查文件格式";
        notchTitle.textContent = "加载失败，请检查文件格式";
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
                    lyricsElement.innerHTML = lyrics.map(line => `<div>${line.text}</div>`).join('');
                    updateLyrics();
                    resolve();
                };
                reader.readAsText(lrcFile);
            });
        }
    } else {
        lyrics = [];
        lyricsElement.innerHTML = '<div>还没找到歌词欸~</div>';
    }
}

async function loadSongInfo(file) {
    if (!file) return;

    // 默认信息
    const defaultInfo = {
        title: "未知标题",
        artist: "未知艺术家",
        album: "未知专辑",
        duration: formatTime(audioPlayer.duration || 0),
        fileType: file.name.split('.').pop(),
        fileLocation: file.webkitRelativePath || file.name
    };

    // 初始化 UI
    songInfo.innerHTML = `
        <p><strong>标题</strong>: ${defaultInfo.title}</p>
        <p><strong>艺术家</strong>: ${defaultInfo.artist}</p>
        <p><strong>专辑</strong>: ${defaultInfo.album}</p>
        <p><strong>时长</strong>: ${defaultInfo.duration}</p>
        <p><strong>文件类型</strong>: .${defaultInfo.fileType}</p>
        <p><strong>文件位置</strong>: ${defaultInfo.fileLocation}</p>
        <div class="scrollbar"><div class="scrollbar-thumb"></div></div>
    `;
    notchLyrics.textContent = "";
    setupScrollbar(songInfo);

    // 如果 jsmediatags 可用，尝试读取元数据
    if (window.jsmediatags) {
        try {
            const tag = await new Promise((resolve, reject) => {
                jsmediatags.read(file, {
                    onSuccess: (tag) => resolve(tag),
                    onError: (error) => reject(error)
                });
            });
            const tags = tag.tags;
            const info = {
                title: tags.title || defaultInfo.title,
                artist: tags.artist || defaultInfo.artist,
                album: tags.album || defaultInfo.album,
                duration: formatTime(audioPlayer.duration || 0),
                fileType: file.name.split('.').pop(),
                fileLocation: file.webkitRelativePath || file.name
            };
            songInfo.innerHTML = `
                <p><strong>标题</strong>: ${info.title}</p>
                <p><strong>艺术家</strong>: ${info.artist}</p>
                <p><strong>专辑</strong>: ${info.album}</p>
                <p><strong>时长</strong>: ${info.duration}</p>
                <p><strong>文件类型</strong>: .${info.fileType}</p>
                <p><strong>文件位置</strong>: ${info.fileLocation}</p>
                <div class="scrollbar"><div class="scrollbar-thumb"></div></div>
            `;
            setupScrollbar(songInfo);
        } catch (error) {
            console.warn("无法读取元数据：", error.info || error);
            // 对于不受支持的格式，保留默认信息即可
        }
    } else {
        console.warn("jsmediatags 未加载，无法读取元数据");
    }
}

function updatePlaylist() {
    if (!playlistItems) return;
    playlistItems.innerHTML = albums.map((album, albumIndex) => {
        const coverUrl = album.cover ? URL.createObjectURL(album.cover) : '';
        return `
            <div class="album">
                <div class="album-header">
                    <div class="album-cover" style="background-image: url('${coverUrl}')"></div>
                    <div class="album-title">${album.name.split('/').slice(-1)[0]}</div>
                </div>
                <ul class="album-songs">
                    ${album.songs.map((song, songIndex) => {
            const path = song.webkitRelativePath || song.name;
            return `<li data-path="${path}" data-index="${albumIndex}-${songIndex}">${path.split('/').pop()}</li>`;
        }).join('')}
                </ul>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.album-header').forEach(header => {
        const songList = header.nextElementSibling;
        header.addEventListener('click', () => {
            songList.classList.toggle('visible');
            songList.style.maxHeight = songList.classList.contains('visible') ? `${songList.scrollHeight}px` : '0';
        });
    });

    document.querySelectorAll('.album-songs li').forEach(li => {
        li.addEventListener('click', () => {
            const path = li.dataset.path;
            const file = fileArray.find(f => (f?.webkitRelativePath || f?.name) === path);
            if (file) processSingleFile(file, URL.createObjectURL(file), true);
        });
    });

    searchBar.oninput = debounce(() => {
        const query = searchBar.value.toLowerCase();
        document.querySelectorAll('.album').forEach(album => {
            const albumTitle = album.querySelector('.album-title').textContent.toLowerCase();
            const songs = album.querySelectorAll('.album-songs li');
            let hasMatch = false;
            songs.forEach(song => {
                song.style.display = song.textContent.toLowerCase().includes(query) || albumTitle.includes(query) ? 'block' : 'none';
                if (song.style.display === 'block') hasMatch = true;
            });
            album.style.display = hasMatch ? 'block' : 'none';
        });
    }, 200);
}

function setupScrollbar(container) {
    const scrollbar = container.querySelector('.scrollbar');
    const thumb = container.querySelector('.scrollbar-thumb');
    if (!scrollbar || !thumb) return;

    const updateScrollbar = () => {
        const contentHeight = container.scrollHeight;
        const visibleHeight = container.clientHeight;
        if (contentHeight <= visibleHeight) {
            scrollbar.style.opacity = '0';
            return;
        }
        scrollbar.style.opacity = '1';
        const thumbHeight = Math.max((visibleHeight / contentHeight) * visibleHeight, 20);
        thumb.style.height = `${thumbHeight}px`;
        const scrollPercentage = container.scrollTop / (contentHeight - visibleHeight);
        const maxTop = visibleHeight - thumbHeight;
        thumb.style.top = `${scrollPercentage * maxTop}px`;
    };

    container.addEventListener('scroll', updateScrollbar);
    updateScrollbar();
}

audioPlayer.addEventListener("loadedmetadata", () => {
    endTime.textContent = formatTime(audioPlayer.duration);
    const savedVolume = localStorage.getItem('volume') || 1;
    volumeProcess.style.width = `${savedVolume * 100}%`;
    notchVolumeProcess.style.width = `${savedVolume * 100}%`;
    audioPlayer.volume = savedVolume;
    volumeValue.textContent = `${Math.round(savedVolume * 100)}%`;
    speedProcess.style.width = "33.33%";
    audioPlayer.playbackRate = 1.0;
    speedValue.textContent = "1.0x";
    setupScrollbar(progressBar);
    setupScrollbar(notchProgressContainer);
    setupScrollbar(volumeBar);
    setupScrollbar(speedBar);
    setupScrollbar(notchVolumeBar);
});

audioPlayer.addEventListener("timeupdate", () => {
    if (!audioPlayer.duration) return;
    const now = performance.now();
    if (now - lastUpdateTime < 100) return;
    lastUpdateTime = now;

    const percentage = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progress.style.width = `${percentage}%`;
    notchProgress.style.width = `${percentage}%`;
    startTime.textContent = formatTime(audioPlayer.currentTime);
    endTime.textContent = formatTime(audioPlayer.duration - audioPlayer.currentTime);
    notchTime.innerHTML = `<span class="current-time">${formatTime(audioPlayer.currentTime)}</span><span class="total-time">${formatTime(audioPlayer.duration)}</span>`;
    if (playing) {
        requestAnimationFrame(updateLyrics);
        requestAnimationFrame(updateWaveform);
        updateNotchLyrics();
    }
});

audioPlayer.addEventListener("ended", playNextSong);

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

    const nextFile = playlistData[nextIndex].file;
    if (nextFile) {
        audioPlayer.pause();
        resetPlaybackUI();
        processSingleFile(nextFile, URL.createObjectURL(nextFile), true);
    }
}

function resetPlaybackUI() {
    progress.style.width = '0%';
    notchProgress.style.width = '0%';
    startTime.textContent = '0:00';
    notchTime.textContent = `0:00 / ${formatTime(audioPlayer.duration || 0)}`;
    playIcon.classList.remove('inactive');
    playIcon.classList.add('active');
    pauseIcon.classList.remove('active');
    pauseIcon.classList.add('inactive');
    notchPlay.style.display = 'inline';
    notchPause.style.display = 'none';
    notch.classList.remove('playing');
    notch.classList.add('paused');
    playing = false;
}

prevBtn?.addEventListener("click", () => {
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

    const prevFile = playlistData[prevIndex].file;
    if (prevFile) {
        audioPlayer.pause();
        resetPlaybackUI();
        processSingleFile(prevFile, URL.createObjectURL(prevFile), true);
    }
});

function togglePlayPause(isPlaying) {
    if (isPlaying === playing) return;
    playing = isPlaying;

    if (isPlaying) {
        audioPlayer.play().then(() => {
            playIcon.classList.remove('active');
            playIcon.classList.add('inactive');
            pauseIcon.classList.remove('inactive');
            pauseIcon.classList.add('active');
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
        pauseIcon.classList.remove('active');
        pauseIcon.classList.add('inactive');
        playIcon.classList.remove('inactive');
        playIcon.classList.add('active');
        notchPlay.style.display = "inline";
        notchPause.style.display = "none";
        notch.classList.remove('playing');
        notch.classList.add('paused');
    }
}

playBtn?.addEventListener("click", () => togglePlayPause(!playing));
notchPlay?.addEventListener("click", () => togglePlayPause(true));
notchPause?.addEventListener("click", () => togglePlayPause(false));
nextBtn?.addEventListener("click", playNextSong);
notchPrev?.addEventListener("click", () => prevBtn.click());
notchNext?.addEventListener("click", () => nextBtn.click());

const throttledMouseMove = throttle((event) => {
    if (activeDragBar === 'progress') updateProgress(event);
    else if (activeDragBar === 'volume') updateVolume(event);
    else if (activeDragBar === 'speed') updateSpeed(event);
    else if (activeDragBar === 'notchProgress') updateNotchProgress(event);
    else if (activeDragBar === 'notchVolume') updateNotchVolume(event);
}, 16);

progressBar?.addEventListener("mousedown", (event) => {
    activeDragBar = 'progress';
    updateProgress(event);
});
volumeBar?.addEventListener("mousedown", (event) => {
    activeDragBar = 'volume';
    updateVolume(event);
});
speedBar?.addEventListener("mousedown", (event) => {
    activeDragBar = 'speed';
    updateSpeed(event);
});
notchProgressContainer?.addEventListener("mousedown", (event) => {
    activeDragBar = 'notchProgress';
    updateNotchProgress(event);
});
notchVolumeBar?.addEventListener("mousedown", (event) => {
    activeDragBar = 'notchVolume';
    updateNotchVolume(event);
});

document.addEventListener("mousemove", throttledMouseMove);
document.addEventListener("mouseup", () => activeDragBar = null);

notch?.addEventListener('mouseenter', () => {
    notch.classList.add('expanded');
    checkTitleOverflow();
    checkLyricsOverflow();
});

notch?.addEventListener('mouseleave', () => {
    notch.classList.remove('expanded');
    checkTitleOverflow();
    checkLyricsOverflow();
});

playlistToggle?.addEventListener('click', togglePlaylist);
closePlaylist?.addEventListener('click', closeAllModals);

function togglePlaylist() {
    if (!playlist) return;
    if (playlist.classList.contains('visible')) {
        closeAllModals();
    } else {
        playlist.style.display = 'block';
        setTimeout(() => {
            playlist.classList.add('visible');
            scrollToCurrentSong();
        }, 10);
        playlistToggle.textContent = "关闭播放列表";
    }
}

function closeAllModals() {
    playlist.classList.remove('visible');
    setTimeout(() => playlist.style.display = 'none', 400);
    infoModal.classList.remove('visible');
    infoModal.style.display = 'none';
    playlistToggle.textContent = "播放列表";
}

infoBtn?.addEventListener('click', () => {
    if (currentFile && infoModal) {
        infoModal.classList.add('visible');
        infoModal.style.display = 'block';
    }
});

closeInfoBtn?.addEventListener('click', closeAllModals);

document.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
        event.preventDefault();
        togglePlaylist();
    } else if (event.key === ' ') {
        event.preventDefault();
        togglePlayPause(!playing);
    } else if (event.key === 'ArrowRight' && !event.ctrlKey) {
        event.preventDefault();
        audioPlayer.currentTime = Math.min(audioPlayer.currentTime + 5, audioPlayer.duration);
    } else if (event.key === 'ArrowLeft' && !event.ctrlKey) {
        event.preventDefault();
        audioPlayer.currentTime = Math.max(audioPlayer.currentTime - 5, 0);
    } else if (event.ctrlKey && event.key === 'ArrowRight' && playlist.style.display !== 'block') {
        event.preventDefault();
        playNextSong();
    } else if (event.ctrlKey && event.key === 'ArrowLeft' && playlist.style.display !== 'block') {
        event.preventDefault();
        prevBtn.click();
    }
});

function updateProgress(event) {
    if (Number.isNaN(audioPlayer.duration) || !progressBar) return;
    const rect = progressBar.getBoundingClientRect();
    const percentage = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    progress.style.width = `${percentage * 100}%`;
    notchProgress.style.width = `${percentage * 100}%`;
    audioPlayer.currentTime = percentage * audioPlayer.duration;
    setupScrollbar(progressBar);
}

function updateNotchProgress(event) {
    if (Number.isNaN(audioPlayer.duration) || !notchProgressContainer) return;
    const rect = notchProgressContainer.getBoundingClientRect();
    const percentage = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    notchProgress.style.width = `${percentage * 100}%`;
    progress.style.width = `${percentage * 100}%`;
    audioPlayer.currentTime = percentage * audioPlayer.duration;
    setupScrollbar(notchProgressContainer);
}

function updateVolume(event) {
    if (!volumeBar) return;
    const rect = volumeBar.getBoundingClientRect();
    const percentage = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    volumeProcess.style.width = `${percentage * 100}%`;
    notchVolumeProcess.style.width = `${percentage * 100}%`;
    audioPlayer.volume = percentage;
    volumeValue.textContent = `${Math.round(percentage * 100)}%`;
    localStorage.setItem('volume', percentage);
    setupScrollbar(volumeBar);
}

function updateNotchVolume(event) {
    if (!notchVolumeBar) return;
    const rect = notchVolumeBar.getBoundingClientRect();
    const percentage = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    notchVolumeProcess.style.width = `${percentage * 100}%`;
    volumeProcess.style.width = `${percentage * 100}%`;
    audioPlayer.volume = percentage;
    volumeValue.textContent = `${Math.round(percentage * 100)}%`;
    localStorage.setItem('volume', percentage);
    setupScrollbar(notchVolumeBar);
}

function updateSpeed(event) {
    if (!speedBar) return;
    const rect = speedBar.getBoundingClientRect();
    const percentage = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    speedProcess.style.width = `${percentage * 100}%`;
    const speed = 0.5 + percentage * 1.5;
    audioPlayer.playbackRate = speed;
    speedValue.textContent = `${speed.toFixed(1)}x`;
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

function updateLyrics() {
    if (!lyrics.length || !lyricsElement || !playing) return;
    const currentTime = audioPlayer.currentTime;
    const lyricLines = lyricsElement.children;
    let activeIndex = 0;

    for (let i = 0; i < lyrics.length; i++) {
        if (currentTime >= lyrics[i].time) activeIndex = i;
        else break;
    }

    for (let i = 0; i < lyricLines.length; i++) {
        const line = lyricLines[i];
        const distance = Math.abs(activeIndex - i);
        if (distance <= 8) {
            if (i === activeIndex) {
                line.classList.add("highlight");
                line.style.filter = "none";
                line.style.marginLeft = "0";
                line.style.visibility = "visible";
            } else {
                line.classList.remove("highlight");
                line.style.filter = `blur(${distance * 0.8}px)`;
                line.style.marginLeft = `${distance * 2}px`;
                line.style.visibility = "visible";
            }
        } else {
            line.style.visibility = "hidden";
        }
    }

    const activeLine = lyricLines[activeIndex];
    if (activeLine) {
        const containerHeight = document.querySelector(".lyricscontainer").clientHeight;
        const activeLineOffset = activeLine.offsetTop;
        const offset = (containerHeight / 2) - activeLineOffset - 0.1 * containerHeight;
        lyricsElement.style.top = `${offset}px`;
    }
}

function updateNotchLyrics() {
    if (!lyrics.length || !notch.classList.contains('expanded')) {
        notchLyrics.style.display = 'none';
        return;
    }

    const currentTime = audioPlayer.currentTime;
    const activeIndex = lyrics.findIndex(lyric => lyric.time > currentTime) - 1;
    if (activeIndex >= 0 && activeIndex < lyrics.length) {
        notchLyrics.textContent = lyrics[activeIndex].text;
        notchLyrics.style.display = 'block';
        checkLyricsOverflow();
    } else {
        notchLyrics.style.display = 'none';
    }
}

function checkLyricsOverflow() {
    const lyricsWidth = notchLyrics.scrollWidth;
    const containerWidth = notchLyrics.parentElement.clientWidth;
    const isExpanded = notch.classList.contains('expanded');

    if (isExpanded && lyricsWidth > containerWidth) {
        notchLyrics.classList.add('marquee');
        const duration = Math.max(10, lyricsWidth / 20);
        notchLyrics.style.animationDuration = `${duration}s`;
    } else {
        notchLyrics.classList.remove('marquee');
        notchLyrics.style.animationDuration = '10s';
    }
}

function checkTitleOverflow() {
    const titleWidth = notchTitle.scrollWidth;
    const containerWidth = notchTitle.parentElement.clientWidth;
    const isExpanded = notch.classList.contains('expanded');

    if (titleWidth > containerWidth) {
        if (isExpanded) {
            notchTitle.classList.add('marquee');
            const duration = Math.max(8, titleWidth / 20);
            notchTitle.style.animationDuration = `${duration}s`;
        } else {
            notchTitle.classList.remove('marquee');
        }
    } else {
        notchTitle.classList.remove('marquee');
        notchTitle.style.animationDuration = '8s';
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

    if (playing) {
        requestAnimationFrame(updateWaveform);
    }
}

function updateBackground(imageSrc) {
    const background = document.querySelector('.background');
    if (!imageSrc) {
        background.style.backgroundColor = 'var(--background)';
        background.style.backgroundImage = '';
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
        background.style.backgroundColor = `rgba(${colors[0].join(',')}, 0.9)`;
        background.style.backgroundImage = `
            radial-gradient(closest-side, rgba(${colors[1].join(',')}, 0.9), rgba(${colors[1].join(',')}, 0)),
            radial-gradient(closest-side, rgba(${colors[2].join(',')}, 0.9), rgba(${colors[2].join(',')}, 0)),
            radial-gradient(closest-side, rgba(${colors[3].join(',')}, 0.9), rgba(${colors[3].join(',')}, 0)),
            radial-gradient(closest-side, rgba(${colors[4].join(',')}, 0.9), rgba(${colors[4].join(',')}, 0)),
            radial-gradient(closest-side, rgba(${colors[0].join(',')}, 0.9), rgba(${colors[0].join(',')}, 0))
        `;
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

function highlightCurrentSong() {
    if (!currentFile || !currentFile.file) return;
    document.querySelectorAll('.album-songs li').forEach(li => li.classList.remove('active'));
    const path = currentFile.file.webkitRelativePath || currentFile.file.name;
    const currentLi = document.querySelector(`.album-songs li[data-path="${path}"]`);
    if (currentLi) currentLi.classList.add('active');
}

function scrollToCurrentSong() {
    const currentSong = playlistItems.querySelector('.album-songs li.active');
    if (currentSong) {
        const albumSongs = currentSong.closest('.album-songs');
        if (!albumSongs.classList.contains('visible')) {
            albumSongs.classList.add('visible');
            albumSongs.style.maxHeight = `${albumSongs.scrollHeight}px`;
        }
        setTimeout(() => currentSong.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden && !audioPlayer.paused) requestAnimationFrame(updateWaveform);
});

window.addEventListener('resize', () => {
    checkTitleOverflow();
    checkLyricsOverflow();
});

window.addEventListener('load', () => {
    playbackMode = localStorage.getItem('playbackMode') || 'loop';
    updateBackground(null);
});