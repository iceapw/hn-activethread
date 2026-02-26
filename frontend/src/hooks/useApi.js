import { useState, useEffect } from "react";

const API_URL = window.location.origin.includes('localhost:5173')
    ? 'http://localhost:3001'
    : '';

export function useApi(endpoint, refreshInterval = null) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = async () => {
        try {
            const res = await fetch(`${API_URL}${endpoint}`);
            if (!res.ok) throw new Error(`${res.status}`);
            const json = await res.json();
            setData(json);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        if (refreshInterval) {
            const id = setInterval(fetchData, refreshInterval);
            return () => clearInterval(id);
        }
    }, [endpoint]);

    return { data, loading, error, refetch: fetchData };
}
