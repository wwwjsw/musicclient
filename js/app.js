class AudioPlayer {
  constructor() {
    this.audio = new Audio();
    this.playlist = [];
    this.currentTrack = 0;
    this.isPlaying = false;
    this.serverUrl = "http://192.168.1.94:8080";
    // Initialize UI elements
    this.initializeElements();
    // Set up event listeners
    this.setupEventListeners();
    // Load initial playlist
    this.loadPlaylist();
  }

  initializeElements() {
    this.playlistElement = document.getElementById('playlist');
    this.playButton = document.getElementById('playButton');
    this.prevButton = document.getElementById('prevButton');
    this.nextButton = document.getElementById('nextButton');
    this.progressBar = document.getElementById('progressBar');
    this.progressContainer = document.getElementById('progressContainer');
    this.currentTimeElement = document.getElementById('currentTime');
    this.durationElement = document.getElementById('duration');
    this.songInfoElement = document.getElementById('songInfo');
    this.volumeSlider = document.getElementById('volumeSlider');

    this.selectedCategory = "all"; // albuns | all
    this.categoryAllButton = document.getElementById('categoryAllButton');
    this.categoryAlbunsButton = document.getElementById('categoryAlbunsButton');

    this.loaderContainer = document.getElementById('loaderContainer');

    this.playerContent = document.getElementById('player-content');
    this.serverUrlInput = document.getElementById('server-url-input');
    this.errorContainer = document.getElementById('errorContainer');
    this.errorMessage = document.getElementById('errorMessage');
    this.retryButton = document.getElementById('retryButton');
  }

  setupEventListeners() {
    // server control
    this.serverUrlInput.addEventListener('change', (e) => this.changeServer(e.target.value))

    // retry control
    this.retryButton.addEventListener('click', () => this.loadPlaylist())

    // filter control
    this.categoryAlbunsButton.addEventListener('click', () => this.changeFilter('albuns'))
    this.categoryAllButton.addEventListener('click', () => this.changeFilter('all'))

    // Playback control events
    this.playButton.addEventListener('click', () => this.togglePlay());
    this.prevButton.addEventListener('click', () => this.playPrevious());
    this.nextButton.addEventListener('click', () => this.playNext());
    this.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));

    // Audio element events
    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('ended', () => this.playNext());
    this.audio.addEventListener('loadedmetadata', () => {
      this.durationElement.textContent = this.formatTime(this.audio.duration);
    });

    // Progress bar click event
    this.progressContainer.addEventListener('click', (e) => this.seek(e));

    // Playlist item click event
    this.playlistElement.addEventListener('click', (e) => {
      const target = e.target;
      if (target.classList.contains('playlist-item')) {
        const index = parseInt(target.getAttribute('data-index'));
        this.playTrack(index);
      }
      else {
        console.warn("click outside playlist")
        // this.playTrack(0);
      }
    });
  }

  async loadPlaylist() {
    this.renderLoader(true);
    this.clearErrorState();
    try {
      const categoryEndpoint = this.selectedCategory === "albuns" ? "/albuns" : "/music"
      const response = await fetch(`${this.serverUrl}${categoryEndpoint}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      this.renderLoader(false);

      this.serverUrlInput.value = this.serverUrl;
      this.playlist = data.data;
      this.renderPlaylist();
    } catch (error) {
      console.log(error);
      this.renderLoader(false);
      this.applyErrorState(error.message);
    }
  }

  applyErrorState(message) {
    this.serverUrlInput.classList.add('error');
    this.errorMessage.textContent = message || 'Falha ao carregar a lista de músicas. Verifique o endereço do servidor.';
    this.errorContainer.style.display = 'flex';
  }

  clearErrorState() {
    this.serverUrlInput.classList.remove('error');
    this.errorContainer.style.display = 'none';
  }

  renderLoader(needRender) {
    if (needRender) {
      this.loaderContainer.style.display = "flex";
      this.playerContent.style.display = "none";
    } else {
      this.loaderContainer.style.display = "none";
      // this.renderPlaylist();
      this.playerContent.style.display = "block";
    }
  }

  renderPlaylist() {
    this.playlistElement.innerHTML = this.playlist
      .map((track, index) => `
                <button class="playlist-item ${index === this.currentTrack ? 'active' : ''}"
                     data-index="${index}">
                    ${track.title} by
                    ${track.artist}
                </button>
            `).join('');
  }

  async playTrack(index) {
    if (index < 0 || index >= this.playlist.length) return;

    this.currentTrack = index;
    const track = this.playlist[index];

    // Update UI
    this.songInfoElement.textContent = `${track.title} - ${track.artist}`;
    this.renderPlaylist();

    try {
      // Set up audio source with range request support
      const response = await fetch(`${this.serverUrl}/music?audio_id=${track.id}`, {
        headers: {
          'Range': 'bytes=0-'
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        this.audio.src = url;
        this.audio.play();
        this.isPlaying = true;
        this.playButton.textContent = '⏸️';
      }
    } catch (error) {
      console.error('Error playing track:', error);
    }
  }

  async changeServer(serverAddress) {
    this.serverUrl = serverAddress;
    await this.loadPlaylist();
  }

  async changeFilter(filter) {
    this.selectedCategory = filter;
    await this.loadPlaylist();
  }

  togglePlay() {
    if (this.audio.src) {
      if (this.isPlaying) {
        this.audio.pause();
        this.playButton.textContent = '⏯️';
      } else {
        this.audio.play();
        this.playButton.textContent = '⏸️';
      }
      this.isPlaying = !this.isPlaying;
    } else if (this.playlist.length > 0) {
      this.playTrack(0);
    }
  }

  playPrevious() {
    const newIndex = (this.currentTrack - 1 + this.playlist.length) % this.playlist.length;
    this.playTrack(newIndex);
  }

  playNext() {
    const newIndex = (this.currentTrack + 1) % this.playlist.length;
    this.playTrack(newIndex);
  }

  updateProgress() {
    const progress = (this.audio.currentTime / this.audio.duration) * 100;
    this.progressBar.style.width = `${progress}%`;
    this.currentTimeElement.textContent = this.formatTime(this.audio.currentTime);
  }

  seek(event) {
    const rect = this.progressContainer.getBoundingClientRect();
    const pos = (event.clientX - rect.left) / rect.width;
    this.audio.currentTime = pos * this.audio.duration;
  }

  setVolume(value) {
    this.audio.volume = value / 100;
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

// Initialize player when document is loaded
let player;
document.addEventListener('DOMContentLoaded', () => {
  player = new AudioPlayer();
});
