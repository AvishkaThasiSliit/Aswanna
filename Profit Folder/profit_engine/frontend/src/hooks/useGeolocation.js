import { useState, useCallback } from 'react';

export function useGeolocation() {
  const [coords, setCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          isLive: true
        });
        setLoading(false);
      },
      (err) => {
        let message = 'Unable to retrieve location';
        if (err.code === 1) message = 'Location access denied by user';
        else if (err.code === 2) message = 'Position unavailable';
        else if (err.code === 3) message = 'Location request timed out';
        setError(message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  return { coords, loading, error, requestLocation, setCoords };
}
