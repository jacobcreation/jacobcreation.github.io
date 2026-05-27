// Configuration
const PROXY_URL = 'https://weather-api.b4rjxr9lk.workers.dev';

// State
let currentData = null;
let currentUnit = localStorage.getItem('weatherUnit') || 'C'; // 'C' or 'F'
let recentCities = JSON.parse(localStorage.getItem('recentCities')) || [];

// Elements
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const weatherContent = document.getElementById('weatherContent');
const loader = document.getElementById('loader');
const errorMsg = document.getElementById('errorMsg');
const bgOverlay = document.getElementById('weatherBgOverlay');
const unitC = document.getElementById('unitC');
const unitF = document.getElementById('unitF');
const recentSearches = document.getElementById('recentSearches');
const weatherAdvice = document.getElementById('weatherAdvice');

async function fetchWeather(city) {
    showLoader();
    hideError();
    hideWeather();

    try {
        const response = await fetch(`${PROXY_URL}?q=${encodeURIComponent(city)}&days=3`);
        if (!response.ok) throw new Error('City not found');

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        currentData = data;
        const { location } = data;
        const displayLocation = location.name.toLowerCase().includes('proper') || location.name.length > 20 
            ? location.region 
            : location.name;
        
        updateRecentCities(displayLocation);
        updateUI();
        showWeather();
    } catch (err) {
        console.error(err);
        showError();
    } finally {
        hideLoader();
    }
}

function updateUI() {
    if (!currentData) return;
    const { location, current, forecast } = currentData;
    const isDay = current.is_day;

    // Background & Theme
    updateTheme(current.condition.code, isDay);

    // Location & Time
    // Heuristic: If name is very specific (like a neighborhood), prioritize the region if it looks like a city
    const displayLocation = location.name.toLowerCase().includes('proper') || location.name.length > 20 
        ? `${location.region}, ${location.country}` 
        : `${location.name}, ${location.region || location.country}`;
    
    document.getElementById('cityName').textContent = displayLocation;
    document.getElementById('fullDate').textContent = new Date(location.localtime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    document.getElementById('localTime').textContent = location.localtime.split(' ')[1];

    // Temperature & Condition
    const isC = currentUnit === 'C';
    document.getElementById('temp').textContent = Math.round(isC ? current.temp_c : current.temp_f);
    document.getElementById('condition').textContent = current.condition.text;
    document.getElementById('weatherIcon').src = `https:${current.condition.icon.replace('64x64', '128x128')}`;
    
    // Advice
    updateAdvice(current.condition.text, isC ? current.temp_c : current.temp_f);

    // Details Grid
    document.getElementById('feelsLike').textContent = `${Math.round(isC ? current.feelslike_c : current.feelslike_f)}°${currentUnit}`;
    document.getElementById('humidity').textContent = `${current.humidity}%`;
    document.getElementById('wind').textContent = isC ? `${current.wind_kph} km/h` : `${current.wind_mph} mph`;
    document.getElementById('pressure').textContent = `${current.pressure_mb} hPa`;
    document.getElementById('visibility').textContent = isC ? `${current.vis_km} km` : `${current.vis_miles} miles`;
    document.getElementById('uvIndex').textContent = current.uv;

    // AQI
    if (current.air_quality) {
        const usEpa = current.air_quality['us-epa-index'];
        const aqiLabels = ['Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous'];
        document.getElementById('aqiValue').textContent = aqiLabels[usEpa - 1] || 'Unknown';
        document.getElementById('aqiBar').firstElementChild.style.width = `${(usEpa / 6) * 100}%`;
        document.getElementById('aqiBar').firstElementChild.style.background = getAqiColor(usEpa);
    }

    // Hourly Forecast
    const hourlyContainer = document.getElementById('hourlyForecast');
    hourlyContainer.innerHTML = '';
    const allHours = [...forecast.forecastday[0].hour, ...forecast.forecastday[1].hour];
    const now = new Date(location.localtime).getTime();
    
    allHours.filter(h => new Date(h.time).getTime() > now).slice(0, 24).forEach(h => {
        const hTime = h.time.split(' ')[1];
        const item = document.createElement('div');
        item.className = 'hourly-item';
        item.innerHTML = `
            <div class="hourly-time">${hTime}</div>
            <img src="https:${h.condition.icon}" class="hourly-icon">
            <div class="hourly-temp">${Math.round(isC ? h.temp_c : h.temp_f)}°</div>
        `;
        hourlyContainer.appendChild(item);
    });

    // Extras
    const today = forecast.forecastday[0];
    document.getElementById('sunrise').textContent = today.astro.sunrise;
    document.getElementById('sunset').textContent = today.astro.sunset;
    document.getElementById('moonPhase').textContent = today.astro.moon_phase;
    document.getElementById('maxTemp').textContent = `${Math.round(isC ? today.day.maxtemp_c : today.day.maxtemp_f)}°${currentUnit}`;
    document.getElementById('minTemp').textContent = `${Math.round(isC ? today.day.mintemp_c : today.day.mintemp_f)}°${currentUnit}`;
    document.getElementById('rainChance').textContent = today.day.daily_chance_of_rain;

    // 3-Day Forecast
    const forecastGrid = document.getElementById('forecastGrid');
    forecastGrid.innerHTML = '';
    forecast.forecastday.forEach(day => {
        const dName = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.innerHTML = `
            <div class="forecast-date">${dName}</div>
            <img src="https:${day.day.condition.icon}" class="forecast-icon">
            <div class="forecast-temp">${Math.round(isC ? day.day.maxtemp_c : day.day.maxtemp_f)}° / ${Math.round(isC ? day.day.mintemp_c : day.day.mintemp_f)}°</div>
            <div class="forecast-cond">${day.day.condition.text}</div>
        `;
        forecastGrid.appendChild(card);
    });

    renderRecentCities();
}

function updateTheme(code, isDay) {
    let themeClass = 'night';
    if (!isDay) themeClass = 'night';
    else if (code === 1000) themeClass = 'sunny';
    else if ([1003, 1006, 1009].includes(code)) themeClass = 'cloudy';
    else if ([1063, 1180, 1183, 1186, 1189, 1192, 1195, 1240, 1243, 1246].includes(code)) themeClass = 'rainy';
    else if ([1066, 1114, 1210, 1213, 1216, 1219, 1222, 1225, 1255, 1258].includes(code)) themeClass = 'snowy';
    
    const colors = {
        sunny: 'var(--sunny-bg)',
        rainy: 'var(--rainy-bg)',
        cloudy: 'var(--cloudy-bg)',
        snowy: 'var(--snowy-bg)',
        night: 'var(--night-bg)'
    };
    
    bgOverlay.style.background = colors[themeClass];
}

function updateAdvice(condition, temp) {
    let advice = "Have a great day!";
    const cond = condition.toLowerCase();
    if (cond.includes('rain')) advice = "Don't forget your umbrella! ☔";
    else if (cond.includes('snow')) advice = "Bundle up, it's snowing! ❄️";
    else if (temp > 30) advice = "Stay hydrated, it's hot out there! ☀️";
    else if (temp < 5) advice = "Wear a warm coat! 🧥";
    else if (cond.includes('clear') || cond.includes('sunny')) advice = "Perfect weather for a walk! 🚶‍♂️";
    weatherAdvice.textContent = advice;
}

function getAqiColor(index) {
    const colors = ['#4ade80', '#facc15', '#fb923c', '#f87171', '#a855f7', '#7e22ce'];
    return colors[index - 1] || '#94a3b8';
}

function updateRecentCities(city) {
    recentCities = [city, ...recentCities.filter(c => c !== city)].slice(0, 5);
    localStorage.setItem('recentCities', JSON.stringify(recentCities));
}

function renderRecentCities() {
    recentSearches.innerHTML = '';
    recentCities.forEach(city => {
        const pill = document.createElement('span');
        pill.className = 'recent-pill';
        pill.textContent = city;
        pill.onclick = () => fetchWeather(city);
        recentSearches.appendChild(pill);
    });
}

// Unit Toggles
unitC.onclick = () => { if (currentUnit === 'F') toggleUnits(); };
unitF.onclick = () => { if (currentUnit === 'C') toggleUnits(); };

function toggleUnits() {
    currentUnit = currentUnit === 'C' ? 'F' : 'C';
    localStorage.setItem('weatherUnit', currentUnit);
    unitC.classList.toggle('active');
    unitF.classList.toggle('active');
    updateUI();
}

// Utils
function showLoader() { loader.style.display = 'block'; }
function hideLoader() { loader.style.display = 'none'; }
function showWeather() { weatherContent.style.display = 'block'; }
function hideWeather() { weatherContent.style.display = 'none'; }
function showError() { errorMsg.style.display = 'block'; }
function hideError() { errorMsg.style.display = 'none'; }

// Events
searchBtn.onclick = () => { const c = cityInput.value.trim(); if (c) fetchWeather(c); };
cityInput.onkeypress = (e) => { if (e.key === 'Enter') { const c = cityInput.value.trim(); if (c) fetchWeather(c); } };

// Init
window.onload = () => {
    renderRecentCities();
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            p => fetchWeather(`${p.coords.latitude},${p.coords.longitude}`),
            () => fetchWeather('auto:ip')
        );
    } else {
        fetchWeather('auto:ip');
    }
};


