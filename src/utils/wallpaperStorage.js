// Per-user local wallpaper storage and curated presets

export const PRESET_WALLPAPERS = [
  {
    id: "sunset-lake",
    title: "Sunset Lake Horizon",
    category: "Nature",
    thumb: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=70",
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "starry-cosmos",
    title: "Starry Milky Way",
    category: "Space",
    thumb: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=400&q=70",
    url: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "misty-mountains",
    title: "Misty Pine Mountains",
    category: "Nature",
    thumb: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=400&q=70",
    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "cyberpunk-rain",
    title: "Tokyo Cyberpunk Rain",
    category: "City",
    thumb: "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=400&q=70",
    url: "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "cozy-library",
    title: "Warm Study Library",
    category: "Aesthetic",
    thumb: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=400&q=70",
    url: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "midnight-ocean",
    title: "Midnight Ocean Waves",
    category: "Nature",
    thumb: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=400&q=70",
    url: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "aurora-borealis",
    title: "Emerald Aurora",
    category: "Space",
    thumb: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=400&q=70",
    url: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "anime-sky",
    title: "Pastel Twilight Clouds",
    category: "Aesthetic",
    thumb: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=400&q=70",
    url: "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "obsidian-waves",
    title: "Minimalist Dark Obsidian",
    category: "Minimal",
    thumb: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=70",
    url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "rain-window",
    title: "Rain on Window Glass",
    category: "Aesthetic",
    thumb: "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=400&q=70",
    url: "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "snowy-peaks",
    title: "Snowy Starlight Peaks",
    category: "Nature",
    thumb: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=400&q=70",
    url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "neon-dusk",
    title: "Lo-Fi Sunset Glow",
    category: "Aesthetic",
    thumb: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=400&q=70",
    url: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1600&q=80",
  },
];

const BG_KEY_PREFIX = "study_bg_";
const CONFIG_KEY_PREFIX = "study_bg_config_";

export const DEFAULT_CONFIG = {
  fit: "cover", // "cover" or "contain"
  dim: 0.45,    // Dark overlay opacity (0.2 to 0.8)
  blur: false,  // Soft background blur
};

// Get user wallpaper URL or null if default
export function getWallpaper(userName) {
  if (!userName) return null;
  try {
    return localStorage.getItem(`${BG_KEY_PREFIX}${userName.toLowerCase()}`) || null;
  } catch (e) {
    console.warn("Could not read wallpaper preference:", e);
    return null;
  }
}

// Set user wallpaper URL
export function setWallpaper(userName, bgUrl) {
  if (!userName) return;
  try {
    const key = `${BG_KEY_PREFIX}${userName.toLowerCase()}`;
    if (bgUrl) {
      localStorage.setItem(key, bgUrl);
    } else {
      localStorage.removeItem(key);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('study_wallpaper_changed', { detail: { userName, bgUrl } }));
    }
  } catch (e) {
    console.warn("Could not save wallpaper preference:", e);
  }
}

// Get user wallpaper configuration
export function getWallpaperConfig(userName) {
  if (!userName) return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(`${CONFIG_KEY_PREFIX}${userName.toLowerCase()}`);
    if (raw) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn("Could not parse wallpaper config:", e);
  }
  return DEFAULT_CONFIG;
}

// Save user wallpaper configuration
export function setWallpaperConfig(userName, config) {
  if (!userName) return;
  try {
    const key = `${CONFIG_KEY_PREFIX}${userName.toLowerCase()}`;
    const merged = { ...DEFAULT_CONFIG, ...config };
    localStorage.setItem(key, JSON.stringify(merged));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('study_wallpaper_changed', { detail: { userName, config: merged } }));
    }
  } catch (e) {
    console.warn("Could not save wallpaper config:", e);
  }
}

// Clear wallpaper completely (reset to default #0d0d0d)
export function clearWallpaper(userName) {
  if (!userName) return;
  try {
    localStorage.removeItem(`${BG_KEY_PREFIX}${userName.toLowerCase()}`);
    localStorage.removeItem(`${CONFIG_KEY_PREFIX}${userName.toLowerCase()}`);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('study_wallpaper_changed', { detail: { userName, bgUrl: null } }));
    }
  } catch (e) {
    console.warn("Could not clear wallpaper:", e);
  }
}

// Compress and store custom image safely in client storage
export function compressCustomImage(file, maxWidth = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      return reject(new Error("Invalid image file"));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
