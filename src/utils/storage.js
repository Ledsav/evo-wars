/**
 * IndexedDB storage utility for persistent session data
 * Stores environment settings and session state
 */

const DB_NAME = 'EvoWarsDB';
const DB_VERSION = 1;
const STORE_NAME = 'settings';

/**
 * Open IndexedDB connection
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Save environment settings to IndexedDB
 */
export async function saveEnvironmentSettings(settings) {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const data = {
      id: 'environment',
      timestamp: Date.now(),
      settings: {
        foodSpawnRate: settings.foodSpawnRate,
        temperature: settings.temperature,
        mutationRate: settings.mutationRate,
        initialPopulation: settings.initialPopulation,
        initialFoodCount: settings.initialFoodCount,
        initialSpecies: settings.initialSpecies,
        separationSections: settings.separationSections,
      }
    };

    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(new Error('Failed to save settings'));

      transaction.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error('Error saving environment settings:', error);
    throw error;
  }
}

/**
 * Load environment settings from IndexedDB
 */
export async function loadEnvironmentSettings() {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get('environment');

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.settings : null);
      };

      request.onerror = () => reject(new Error('Failed to load settings'));

      transaction.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error('Error loading environment settings:', error);
    return null;
  }
}

/**
 * Save sample frequency setting
 */
export async function saveSampleFrequency(frequency) {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const data = {
      id: 'sampleFrequency',
      timestamp: Date.now(),
      frequency: frequency
    };

    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(new Error('Failed to save sample frequency'));

      transaction.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error('Error saving sample frequency:', error);
    throw error;
  }
}

/**
 * Load sample frequency setting
 */
export async function loadSampleFrequency() {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get('sampleFrequency');

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.frequency : null);
      };

      request.onerror = () => reject(new Error('Failed to load sample frequency'));

      transaction.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error('Error loading sample frequency:', error);
    return null;
  }
}

/**
 * Clear all stored data
 */
export async function clearStorage() {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear storage'));

      transaction.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error('Error clearing storage:', error);
    throw error;
  }
}

/**
 * Get all stored data (for debugging)
 */
export async function getAllStoredData() {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get all data'));

      transaction.oncomplete = () => db.close();
    });
  } catch (error) {
    console.error('Error getting all stored data:', error);
    return [];
  }
}
