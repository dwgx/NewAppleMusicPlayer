const svgcontainer = document.querySelector('.svgcontainer');
const audioFileInput = document.querySelector('.audiofile');
const audioPlayer = document.querySelector('.player');
const playlistItems = document.querySelector('.playlist-items');
const playlist = document.querySelector('.playlist');
const playlistToggle = document.querySelector('.playlist-toggle');
const closePlaylist = document.querySelector('.close-playlist');
const searchBar = document.querySelector('.search-bar');
const lyricsContainer = document.querySelector('.lyricscontainer');
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
let currentPlayer = null;
let videoPlayer = null;
let lastLyricUpdateTime = 0;

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
    if (Number.isNaN(seconds) || seconds === undefined) return "0:00";
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
async function captureVideoFrame(file) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(file);
        video.currentTime = 1;
        video.addEventListener('seeked', () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                resolve({ name: 'cover.png', url });
                video.src = '';
            });
        }, { once: true });
        video.addEventListener('error', () => resolve(null), { once: true });
    });
}

function setupVideoControls(video) {
    const progress = video.querySelector('.video-progress');
    const progressFill = video.querySelector('.video-progress-fill');
    const playBtn = video.querySelector('.video-play');
    const pauseBtn = video.querySelector('.video-pause');

    let isDragging = false;
    let startX, startY, currentLeft, currentTop;
    let rafId = null;

    video.style.left = '50%';
    video.style.top = '50%';
    video.style.transform = 'translate(-50%, -50%)';
    video.style.transition = 'left 0.1s ease-out, top 0.1s ease-out';

    video.addEventListener('mousedown', (e) => {
        if (e.target === video) {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            currentLeft = parseFloat(video.style.left) || 50;
            currentTop = parseFloat(video.style.top) || 50;
            video.style.transition = '';
            e.preventDefault();
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            const deltaX = (e.clientX - startX) / window.innerWidth * 100;
            const deltaY = (e.clientY - startY) / window.innerHeight * 100;
            let newLeft = currentLeft + deltaX;
            let newTop = currentTop + deltaY;

            const videoRect = video.getBoundingClientRect();
            const maxLeft = (window.innerWidth - videoRect.width / 2) / window.innerWidth * 100;
            const minLeft = (videoRect.width / 2) / window.innerWidth * 100;
            const maxTop = (window.innerHeight - videoRect.height / 2) / window.innerHeight * 100;
            const minTop = (videoRect.height / 2) / window.innerHeight * 100;

            newLeft = Math.max(minLeft, Math.min(newLeft, maxLeft));
            newTop = Math.max(minTop, Math.min(newTop, maxTop));

            video.style.left = `${newLeft}%`;
            video.style.top = `${newTop}%`;
        });
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            video.style.transition = 'left 0.1s ease-out, top 0.1s ease-out';
            cancelAnimationFrame(rafId);
        }
    });

    video.addEventListener('timeupdate', () => {
        const percentage = (video.currentTime / video.duration) * 100;
        progressFill.style.width = `${percentage}%`;
    });

    progress.addEventListener('click', (e) => {
        const rect = progress.getBoundingClientRect();
        const percentage = (e.clientX - rect.left) / rect.width;
        video.currentTime = percentage * video.duration;
    });

    video.addEventListener('click', () => {
        toggleVideoPlayPause(video, playBtn, pauseBtn);
    });

    playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleVideoPlayPause(video, playBtn, pauseBtn, true);
    });

    pauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleVideoPlayPause(video, playBtn, pauseBtn, false);
    });
}

function toggleVideoPlayPause(video, playBtn, pauseBtn, forcePlay = null) {
    const shouldPlay = forcePlay !== null ? forcePlay : video.paused;
    if (shouldPlay) {
        video.play();
        playBtn.style.display = 'none';
        pauseBtn.style.display = 'block';
        playing = true;
        playIcon.classList.remove('active');
        playIcon.classList.add('inactive');
        pauseIcon.classList.remove('inactive');
        pauseIcon.classList.add('active');
        notchPlay.style.display = "none";
        notchPause.style.display = "inline";
        notch.classList.remove('paused');
        notch.classList.add('playing');
    } else {
        video.pause();
        playBtn.style.display = 'block';
        pauseBtn.style.display = 'none';
        playing = false;
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
                    lyricsElement.innerHTML = lyrics.length
                        ? lyrics.map(line => `<div>${line.text}</div>`).join('')
                        : '<div>歌词文件为空</div>';
                    updateLyrics();
                    updateNotchLyrics();
                    resolve();
                };
                reader.onerror = () => {
                    lyrics = [];
                    lyricsElement.innerHTML = '<div>无法加载歌词文件</div>';
                    notchLyrics.textContent = "无法加载歌词文件";
                    updateLyrics();
                    updateNotchLyrics();
                    resolve();
                };
                reader.readAsText(lyricFile);
            });
        }
    }
    lyrics = [];
    lyricsElement.innerHTML = '<div>还没有歌词哦~</div>';
    notchLyrics.textContent = "";
    updateLyrics();
    updateNotchLyrics();
}

async function loadSongInfo(file) {
    if (!file) return;

    const defaultInfo = {
        title: "未知标题",
        artist: file.type.startsWith("video/") ? "视频" : "未知艺术家",
        album: "未知专辑",
        duration: formatTime(currentPlayer?.duration || 0),
        fileType: file.name.split('.').pop(),
        fileLocation: file.webkitRelativePath || file.name
    };

    songInfo.innerHTML = `
        <p><strong>标题</strong>: ${defaultInfo.title}</p>
        <p><strong>艺术家</strong>: ${defaultInfo.artist}</p>
        <p><strong>专辑</strong>: ${defaultInfo.album}</p>
        <p><strong>时长</strong>: ${defaultInfo.duration}</p>
        <p><strong>文件类型</strong>: .${defaultInfo.fileType}</p>
        <p><strong>文件位置</strong>: ${defaultInfo.fileLocation}</p>
        <div class="scrollbar"><div class="scrollbar-thumb"></div></div>
    `;
    setupScrollbar(songInfo);

    if (window.jsmediatags && file.type.startsWith("audio/")) {
        try {
            const tag = await new Promise((resolve, reject) => {
                jsmediatags.read(file, {
                    onSuccess: resolve,
                    onError: reject
                });
            });
            const tags = tag.tags;
            const info = {
                title: tags.title || defaultInfo.title,
                artist: tags.artist || defaultInfo.artist,
                album: tags.album || defaultInfo.album,
                duration: formatTime(currentPlayer?.duration || 0),
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
            console.warn("无法读取元数据：", error);
        }
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
                    ${album.media.map((media, mediaIndex) => {
            const path = media.webkitRelativePath || media.name;
            const isVideo = media.type.startsWith("video/");
            const icon = isVideo ? '<i class="fas fa-video"></i>' : '<i class="fas fa-music"></i>';
            return `<li data-path="${path}" data-index="${albumIndex}-${mediaIndex}">${icon} ${path.split('/').pop()}</li>`;
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

function updateTimeHandler() {
    if (!currentPlayer || !currentPlayer.duration) return;
    const now = performance.now();
    if (now - lastUpdateTime < 100) return;
    lastUpdateTime = now;

    const percentage = (currentPlayer.currentTime / currentPlayer.duration) * 100;
    progress.style.width = `${percentage}%`;
    notchProgress.style.width = `${percentage}%`;
    startTime.textContent = formatTime(currentPlayer.currentTime);
    endTime.textContent = formatTime(currentPlayer.duration - currentPlayer.currentTime);
    notchTime.innerHTML = `<span class="current-time">${formatTime(currentPlayer.currentTime)}</span><span class="total-time">${formatTime(currentPlayer.duration)}</span>`;
    if (playing && currentPlayer === audioPlayer) {
        requestAnimationFrame(updateLyrics);
        requestAnimationFrame(updateWaveform);
        updateNotchLyrics();
    }
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
                currentPlayer.currentTime = 0;
                resetPlaybackUI();
                return;
            }
            break;
        case 'reverse':
            nextIndex = currentIndex - 1;
            if (nextIndex < 0) {
                togglePlayPause(false);
                currentPlayer.currentTime = 0;
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
        currentPlayer.pause();
        resetPlaybackUI();
        processSingleFile(nextFile, URL.createObjectURL(nextFile), true);
    }
}

function resetPlaybackUI() {
    progress.style.width = '0%';
    notchProgress.style.width = '0%';
    startTime.textContent = '0:00';
    notchTime.innerHTML = `<span class="current-time">0:00</span><span class="total-time">${formatTime(currentPlayer?.duration || 0)}</span>`;
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
        currentPlayer.pause();
        resetPlaybackUI();
        processSingleFile(prevFile, URL.createObjectURL(prevFile), true);
    }
});

function togglePlayPause(isPlaying) {
    if (!currentPlayer || isPlaying === playing) return;
    playing = isPlaying;

    if (isPlaying) {
        currentPlayer.play().then(() => {
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
        currentPlayer.pause();
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
});
notch?.addEventListener('mouseleave', () => {
    notch.classList.remove('expanded');
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
    } else if (event.key === ' ' && currentPlayer) {
        event.preventDefault();
        togglePlayPause(!playing);
    } else if (event.key === 'ArrowRight' && !event.ctrlKey && currentPlayer) {
        event.preventDefault();
        currentPlayer.currentTime = Math.min(currentPlayer.currentTime + 5, currentPlayer.duration);
    } else if (event.key === 'ArrowLeft' && !event.ctrlKey && currentPlayer) {
        event.preventDefault();
        currentPlayer.currentTime = Math.max(currentPlayer.currentTime - 5, 0);
    } else if (event.ctrlKey && event.key === 'ArrowRight' && playlist.style.display !== 'block') {
        event.preventDefault();
        playNextSong();
    } else if (event.ctrlKey && event.key === 'ArrowLeft' && playlist.style.display !== 'block') {
        event.preventDefault();
        prevBtn.click();
    }
});

function updateProgress(event) {
    if (!currentPlayer || Number.isNaN(currentPlayer.duration) || !progressBar) return;
    const rect = progressBar.getBoundingClientRect();
    const percentage = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    progress.style.width = `${percentage * 100}%`;
    notchProgress.style.width = `${percentage * 100}%`;
    currentPlayer.currentTime = percentage * currentPlayer.duration;
    setupScrollbar(progressBar);
}

function updateNotchProgress(event) {
    if (!currentPlayer || Number.isNaN(currentPlayer.duration) || !notchProgressContainer) return;
    const rect = notchProgressContainer.getBoundingClientRect();
    const percentage = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    notchProgress.style.width = `${percentage * 100}%`;
    progress.style.width = `${percentage * 100}%`;
    currentPlayer.currentTime = percentage * currentPlayer.duration;
    setupScrollbar(notchProgressContainer);
}

function updateVolume(event) {
    if (!volumeBar || !currentPlayer) return;
    const rect = volumeBar.getBoundingClientRect();
    const percentage = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    volumeProcess.style.width = `${percentage * 100}%`;
    notchVolumeProcess.style.width = `${percentage * 100}%`;
    currentPlayer.volume = percentage;
    volumeValue.textContent = `${Math.round(percentage * 100)}%`;
    localStorage.setItem('volume', percentage);
    setupScrollbar(volumeBar);
}

function updateNotchVolume(event) {
    if (!notchVolumeBar || !currentPlayer) return;
    const rect = notchVolumeBar.getBoundingClientRect();
    const percentage = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    notchVolumeProcess.style.width = `${percentage * 100}%`;
    volumeProcess.style.width = `${percentage * 100}%`;
    currentPlayer.volume = percentage;
    volumeValue.textContent = `${Math.round(percentage * 100)}%`;
    localStorage.setItem('volume', percentage);
    setupScrollbar(notchVolumeBar);
}

function updateSpeed(event) {
    if (!speedBar || !currentPlayer) return;
    const rect = speedBar.getBoundingClientRect();
    const percentage = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    speedProcess.style.width = `${percentage * 100}%`;
    const speed = 0.5 + percentage * 1.5;
    currentPlayer.playbackRate = speed;
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

function updateLyrics() {
    if (!lyrics.length || !lyricsElement || !playing || currentPlayer !== audioPlayer) {
        return;
    }
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
    const now = performance.now();
    if (now - lastLyricUpdateTime < 200) return;
    lastLyricUpdateTime = now;

    if (currentFile && currentFile.file.type.startsWith("video/")) {
        if (notchLyrics.textContent !== "视频播放中") {
            notchLyrics.textContent = "视频播放中";
            notchLyrics.style.display = 'block';
        }
        return;
    }

    if (lyrics.length && playing && currentPlayer === audioPlayer) {
        const currentTime = currentPlayer.currentTime;
        let activeLyric = "";
        for (let i = 0; i < lyrics.length; i++) {
            if (currentTime >= lyrics[i].time) {
                activeLyric = lyrics[i].text;
            } else {
                break;
            }
        }
        if (notchLyrics.textContent !== activeLyric) {
            notchLyrics.textContent = activeLyric;
            notchLyrics.style.display = activeLyric ? 'block' : 'none';
        }
    } else {
        if (notchLyrics.textContent !== "") {
            notchLyrics.textContent = "";
            notchLyrics.style.display = 'none';
        }
    }
}

async function processSingleFile(file, src, autoPlay = true) {
    try {
        if (currentPlayer) {
            currentPlayer.pause();
            currentPlayer.removeEventListener('timeupdate', updateTimeHandler);
            currentPlayer.removeEventListener('ended', playNextSong);
            resetPlaybackUI();
        }

        currentFile = { file, src };
        const isVideo = file.type.startsWith("video/");

        lyricsContainer.innerHTML = '';
        lyricsElement.style.display = 'none';
        if (isVideo) {
            if (!videoPlayer) {
                videoPlayer = document.createElement('video');
                videoPlayer.classList.add('video-player');
                videoPlayer.controls = false;
                const controls = document.createElement('div');
                controls.className = 'video-controls';
                controls.innerHTML = `
                    <div class="video-progress">
                        <div class="video-progress-fill"></div>
                    </div>
                    <div class="video-control-buttons">
                        <i class="fas fa-play video-play" style="font-size: 24px; color: white;"></i>
                        <i class="fas fa-pause video-pause" style="font-size: 24px; color: white; display: none;"></i>
                    </div>
                `;
                videoPlayer.appendChild(controls);
            }
            videoPlayer.src = src;
            currentPlayer = videoPlayer;
            lyricsContainer.appendChild(videoPlayer);
            setupVideoControls(videoPlayer);
            lyricsElement.innerHTML = '<div>视频播放中</div>';
        } else {
            audioPlayer.src = src;
            currentPlayer = audioPlayer;
            lyricsContainer.appendChild(lyricsElement);
            lyricsElement.style.display = 'flex';
            await loadMatchingLrc(file.webkitRelativePath || file.name);
        }

        currentPlayer.currentTime = 0;
        resetPlaybackUI();

        const savedVolume = localStorage.getItem('volume') || 1;
        currentPlayer.volume = parseFloat(savedVolume);
        volumeProcess.style.width = `${savedVolume * 100}%`;
        notchVolumeProcess.style.width = `${savedVolume * 100}%`;
        volumeValue.textContent = `${Math.round(savedVolume * 100)}%`;

        currentPlayer.playbackRate = 1;
        speedProcess.style.width = `33.33%`;
        speedValue.textContent = `1.0x`;

        let filename = file.name.split('.').slice(0, -1).join('.');
        if (file.type.startsWith("audio/") && window.jsmediatags) {
            try {
                const tag = await new Promise((resolve, reject) => {
                    jsmediatags.read(file, {
                        onSuccess: resolve,
                        onError: reject
                    });
                });
                filename = tag.tags.title || filename;
            } catch (error) {
                console.warn("无法读取音频元数据：", error);
            }
        }
        audioName.textContent = filename;
        notchTitle.textContent = filename;

        const album = albums.find(a => a.media.some(m => m === file));
        let cover = album?.cover;
        if (!cover && isVideo) {
            cover = await captureVideoFrame(file);
        }
        if (cover) {
            const coverSrc = cover.url || URL.createObjectURL(cover);
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

        await loadSongInfo(file);
        highlightCurrentSong();

        currentPlayer.addEventListener('loadedmetadata', () => {
            endTime.textContent = formatTime(currentPlayer.duration || 0);
            notchTime.innerHTML = `<span class="current-time">0:00</span><span class="total-time">${formatTime(currentPlayer.duration || 0)}</span>`;
            if (autoPlay) {
                togglePlayPause(true);
            }
        }, { once: true });

        currentPlayer.addEventListener('timeupdate', updateTimeHandler);
        currentPlayer.addEventListener('ended', playNextSong);
    } catch (error) {
        console.error("处理文件失败：", error);
        audioName.textContent = "加载失败，请检查文件格式";
        notchTitle.textContent = "加载失败，请检查文件格式";
    }
}

async function processFolder(files) {
    const mediaFiles = Array.from(files).filter(file =>
        file.type.startsWith("audio/") || file.type.startsWith("video/")
    );
    const lyricFiles = Array.from(files).filter(file =>
        file.name.toLowerCase().endsWith(".lrc") || file.name.toLowerCase().endsWith(".srt")
    );
    const imageFiles = Array.from(files).filter(file => file.type.startsWith("image/"));
    const albumMap = {};

    mediaFiles.forEach(file => {
        const path = file.webkitRelativePath || file.name;
        const albumPath = path.split('/').slice(0, -1).join('/');
        if (!albumMap[albumPath]) albumMap[albumPath] = { media: [], cover: null };
        albumMap[albumPath].media.push(file);
    });

    imageFiles.forEach(image => {
        const path = image.webkitRelativePath || image.name;
        const albumPath = path.split('/').slice(0, -1).join('/');
        if (albumMap[albumPath] && image.name.toLowerCase() === "default.png") {
            albumMap[albumPath].cover = image;
        }
    });

    albums = Object.keys(albumMap).map(albumPath => ({
        name: albumPath,
        media: albumMap[albumPath].media,
        cover: albumMap[albumPath].cover
    }));

    playlistData = albums.flatMap(album => album.media.map(file => ({
        file,
        name: (file.webkitRelativePath || file.name).split('/').pop()
    })));
    allLrcFiles = lyricFiles.map(file => file.webkitRelativePath || file.name);

    updatePlaylist();
    if (mediaFiles.length) await processSingleFile(mediaFiles[0], URL.createObjectURL(mediaFiles[0]), true);
}

function updateWaveform() {
    if (!analyser || !dataArray || !playing || currentPlayer !== audioPlayer) {
        waveformBars.forEach(bar => bar.style.transform = 'scaleY(0.2)');
        return;
    }

    analyser.getByteTimeDomainData(dataArray);
    const barCount = waveformBars.length;
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

    if (playing && currentPlayer === audioPlayer) {
        requestAnimationFrame(updateWaveform);
    }
}

function updateBackground(imageSrc) {
    const background = document.querySelector('.background');
    const backgroundMode = localStorage.getItem('backgroundMode') || 'color';

    if (backgroundMode === 'image' && imageSrc) {
        background.style.backgroundImage = `url(${imageSrc})`;
        background.style.backgroundSize = "cover";
        background.style.backgroundPosition = "center";
        background.style.filter = "blur(30px) brightness(0.5)";
        applyWaveformGradient(['#fff']);
        return;
    }

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
        background.style.backgroundSize = "130vmax 130vmax, 80vmax 80vmax, 90vmax 90vmax, 110vmax 110vmax, 90vmax 90vmax";
        background.style.backgroundPosition = "-80vmax -80vmax, 60vmax -30vmax, 10vmax 10vmax, -30vmax -10vmax, 50vmax 50vmax";
        background.style.filter = "blur(10px)";
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
    document.querySelectorAll('.album-songs li').forEach(li => {
        li.classList.remove('active');
        if (li.dataset.path === (currentFile?.file?.webkitRelativePath || currentFile?.file?.name)) {
            li.classList.add('active');
        }
    });
}

function scrollToCurrentSong() {
    const activeSong = document.querySelector('.album-songs li.active');
    if (activeSong) {
        const album = activeSong.closest('.album');
        const songList = activeSong.closest('.album-songs');
        if (!songList.classList.contains('visible')) {
            songList.classList.add('visible');
            songList.style.maxHeight = `${songList.scrollHeight}px`;
        }
        setTimeout(() => {
            activeSong.scrollIntoView({ behavior: 'smooth', block: 'center' });
            album.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden && currentPlayer && !currentPlayer.paused && currentPlayer === audioPlayer) {
        requestAnimationFrame(updateWaveform);
    }
});

window.addEventListener('resize', () => {
});

document.addEventListener('DOMContentLoaded', () => {
    const savedVolume = localStorage.getItem('volume') || 1;
    volumeProcess.style.width = `${savedVolume * 100}%`;
    notchVolumeProcess.style.width = `${savedVolume * 100}%`;
    volumeValue.textContent = `${Math.round(savedVolume * 100)}%`;
    if (currentPlayer) {
        currentPlayer.volume = parseFloat(savedVolume);
    }
    updateBackground(null);
    lyricsElement.innerHTML = '<div>点击音乐图标选择音频或视频文件</div>';
    lyricsElement.style.display = 'flex';
    lyricsContainer.appendChild(lyricsElement);
    updateLyrics();
});

window.addEventListener('message', (event) => {
    if (event.data.type === 'updateSettings') {
        const { playbackMode: newPlaybackMode, backgroundMode } = event.data;
        playbackMode = newPlaybackMode;
        localStorage.setItem('playbackMode', newPlaybackMode);
        localStorage.setItem('backgroundMode', backgroundMode);
        const coverSrc = notchAlbumArt.style.backgroundImage.match(/url\(["']?(.+)["']?\)/)?.[1];
        updateBackground(coverSrc);
    }
});