// Elements & State
let globalWeatherData = null;
let currentDayIndex = 0;
let globalTimezone = 'auto'; // Store location's timezone

const heroTemp = document.getElementById('hero-temp');
// ... (rest elements)

// ...

// Initial Load
window.addEventListener('load', () => {
    // Set date immediately
    updateClockAndDate();

    // Start Real-time Clock
    setInterval(updateClockAndDate, 1000);

    // Auto locate
    getUserLocation();
});

function updateClockAndDate() {
    const now = new Date();

    // Time & Date Options
    const timeOptions = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZoneName: 'short' // Shows timezone offset/name e.g. GMT+9
    };
    const dateOptions = {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    };

    // Use specific timezone if we have one and it is valid
    if (globalTimezone && globalTimezone !== 'auto') {
        try {
            // Validate timezone
            Intl.DateTimeFormat(undefined, { timeZone: globalTimezone });
            timeOptions.timeZone = globalTimezone;
            dateOptions.timeZone = globalTimezone;
        } catch (e) {
            console.warn('Invalid Timezone:', globalTimezone);
        }
    }

    currentTimeEl.textContent = now.toLocaleTimeString('en-US', timeOptions);
    currentDateEl.textContent = now.toLocaleDateString('en-US', dateOptions);
}
const heroCondition = document.getElementById('hero-condition');
const heroWind = document.getElementById('hero-wind');
const heroHumidity = document.getElementById('hero-humidity');
const heroRain = document.getElementById('hero-rain');
const heroImage = document.getElementById('hero-image');
const locationText = document.getElementById('location-text');
const currentDateEl = document.getElementById('current-date');
const currentTimeEl = document.getElementById('current-time');
const weeklyList = document.getElementById('weekly-list');

// Search & Modal Elements
const searchTriggerBtn = document.getElementById('search-trigger-btn');
const searchOverlay = document.getElementById('search-overlay');
const closeSearchBtn = document.getElementById('close-search');
const searchBtn = document.getElementById('search-btn');
const cityInput = document.getElementById('city-input');
const locationBtn = document.getElementById('location-btn');
const errorMsg = document.getElementById('error-message');

// Dropdown/Location Click also triggers search
document.querySelector('.location-container').addEventListener('click', openSearch);

// Event Listeners
searchTriggerBtn.addEventListener('click', openSearch);
closeSearchBtn.addEventListener('click', closeSearch);
searchBtn.addEventListener('click', handleSearch);
locationBtn.addEventListener('click', getUserLocation);
cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
});



function openSearch() {
    searchOverlay.classList.add('active');
    cityInput.focus();
}

function closeSearch() {
    searchOverlay.classList.remove('active');
    errorMsg.textContent = '';
}

// Data Fetching
async function handleSearch() {
    const city = cityInput.value.trim();
    if (!city) return;

    try {
        const geoData = await getCoordinates(city);
        if (!geoData) {
            errorMsg.textContent = 'City not found.';
            return;
        }

        await fetchAndRenderWeather(geoData.latitude, geoData.longitude, {
            name: geoData.name,
            country: geoData.country
        });

        closeSearch();
        cityInput.value = '';
    } catch (e) {
        console.error(e);
        errorMsg.textContent = 'Error fetching data.';
    }
}

async function getUserLocation() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const locationName = await getCityName(latitude, longitude);
                const locObj = {
                    name: locationName.city || locationName.locality || "Current Location",
                    country: locationName.countryName || ""
                };
                await fetchAndRenderWeather(latitude, longitude, locObj);
                closeSearch(); // if open
            } catch (e) {
                console.error(e);
            }
        },
        (err) => {
            console.warn(err);
            // Fallback to a default city if location fails on load? Or just wait.
            // Let's fallback to "New York" as a demo if initial load fails
            fetchAndRenderWeather(40.71, -74.01, { name: "New York", country: "USA" });
        }
    );
}

// API Helpers
async function getCoordinates(city) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const res = await fetch(url);
    const data = await res.json();
    return data.results ? data.results[0] : null;
}

async function getCityName(lat, lon) {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const res = await fetch(url);
    return await res.json();
}

async function fetchAndRenderWeather(lat, lon, locationInfo) {
    // We need current, hourly (24h) and daily (7 days)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,precipitation,rain,showers,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto&forecast_days=7`;

    const res = await fetch(url);
    const data = await res.json();

    globalWeatherData = data;
    updateDashboard(data, locationInfo);
}

// Rendering
// Rendering
function updateDashboard(data, location) {
    const current = data.current;

    // 0. Background Update based on Local Time
    // Open-Meteo returns 'time' in ISO8601, e.g. "2023-10-27T14:00"
    // We can parse the hour from this string directly since timezone=auto is set.

    // CAPTURE TIMEZONE
    globalTimezone = data.timezone;
    updateClockAndDate(); // Force update immediately

    try {
        const localTimeISO = current.time; // "YYYY-MM-DDTHH:MM"
        const hour = parseInt(localTimeISO.split('T')[1].split(':')[0], 10);
        updateBackground(hour, current.weather_code);
    } catch (e) {
        console.warn('Could not parse time for background', e);
    }

    // 1. Header Info
    locationText.textContent = `${location.name}, ${location.country}`;

    // 2. Hero Section
    heroTemp.textContent = Math.round(current.temperature_2m);
    heroWind.textContent = `${current.wind_speed_10m} km/h`;
    heroHumidity.textContent = `${current.relative_humidity_2m}%`;
    heroRain.textContent = `${current.precipitation} mm`;

    const weatherInfo = getWeatherMetadata(current.weather_code, current.is_day);
    heroCondition.textContent = weatherInfo.description;

    // Update 3D Icon
    heroImage.src = weatherInfo.image;

    // 3. Graph
    renderGraph(data.hourly);

    // 4. Sidebar Forecast
    renderWeekly(data.daily);
}

const bgVideo = document.getElementById('bg-video');

function updateBackground(hour, code) {
    const body = document.body;
    body.className = ''; // Reset class for gradients/stars logic

    let videoSrc = '';
    let modeClass = '';

    // Video Sources (Reliable Direct Links)
    const videos = {
        // Sunrise/Morning - Coverr
        morning: 'bg-morning.mp4',
        // Day/Clouds - Public Domain (Wikimedia)
        day: 'bg-day.mp4',
        // Night/Stars - Coverr
        night: 'bg-night.mp4'
    };

    if (hour >= 5 && hour < 11) {
        modeClass = 'bg-morning';
        videoSrc = videos.morning;
    } else if (hour >= 11 && hour < 18) {
        modeClass = 'bg-day';
        videoSrc = videos.day;
    } else {
        modeClass = 'bg-night';
        videoSrc = videos.night;
    }

    body.classList.add(modeClass);

    // Only update if source changes to prevent flickering/reloading
    // We check if the current src contains the target filename to allow for base URL diffs
    if (!bgVideo.src.includes(videoSrc)) {
        bgVideo.src = videoSrc;
        bgVideo.load();
        bgVideo.play().catch(e => console.log("Autoplay blocked/failed", e));
    }
}

function renderGraph(hourly, startFromNow = true, targetDate = null) {
    let start, end;

    if (startFromNow) {
        // Next 24 hours from current time
        const nowISO = new Date().toISOString().slice(0, 13); // Hour precision
        const startIndex = hourly.time.findIndex(t => t.startsWith(nowISO));
        start = startIndex === -1 ? 0 : startIndex;
        end = Math.min(start + 24, hourly.time.length);
    } else if (targetDate) {
        // Specific Day (00:00 to 23:00)
        const startIndex = hourly.time.findIndex(t => t.startsWith(targetDate));
        if (startIndex === -1) return; // No data for this day
        start = startIndex;
        end = Math.min(start + 24, hourly.time.length);
    } else {
        return;
    }

    const temps = hourly.temperature_2m.slice(start, end);
    const times = hourly.time.slice(start, end);

    if (temps.length === 0) return;

    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const range = maxTemp - minTemp || 1;

    const svg = document.getElementById('temp-graph');
    const tooltip = document.getElementById('graph-tooltip');

    const width = 500;
    const height = 100;
    const padding = 10;

    // Generate Points & Store Metadata
    const pointsData = temps.map((t, i) => {
        const x = (i / (temps.length - 1)) * width;
        const y = height - padding - ((t - minTemp) / range) * (height - 2 * padding);
        return { x, y, temp: t, time: times[i] };
    });

    // Create Path String
    let d = `M ${pointsData[0].x},${pointsData[0].y}`;
    for (let i = 1; i < pointsData.length; i++) {
        d += ` L ${pointsData[i].x},${pointsData[i].y}`;
    }

    // Reset SVG
    svg.innerHTML = '';

    // Area Path
    const dArea = `${d} L ${width},${height} L 0,${height} Z`;
    const pathArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathArea.setAttribute('d', dArea);
    pathArea.setAttribute('class', 'graph-area');
    svg.appendChild(pathArea);

    // Line Path
    const pathLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathLine.setAttribute('d', d);
    pathLine.setAttribute('class', 'graph-line');
    svg.appendChild(pathLine);

    // Points (Circles) - Add interaction
    pointsData.forEach((pt, index) => {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

        // 1. Transparent Hit Area (Larger)
        const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hitArea.setAttribute('cx', pt.x);
        hitArea.setAttribute('cy', pt.y);
        hitArea.setAttribute('r', 15);
        hitArea.setAttribute('fill', 'transparent');
        hitArea.setAttribute('style', 'cursor: pointer;');

        // 2. Visible Point
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pt.x);
        circle.setAttribute('cy', pt.y);
        circle.setAttribute('r', 4);
        circle.setAttribute('class', 'graph-point');

        // Interaction
        const showTooltip = (e) => {
            const date = new Date(pt.time);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Update Tooltip
            tooltip.innerHTML = `<strong>${timeStr}</strong> • ${Math.round(pt.temp)}°`;
            tooltip.style.left = `${(pt.x / width) * 100}%`;
            tooltip.style.top = `${(pt.y / height) * 100}%`;
            tooltip.classList.add('visible');
        };

        const hideTooltip = () => {
            tooltip.classList.remove('visible');
        };

        // Mouse Events
        hitArea.addEventListener('mouseenter', showTooltip);
        hitArea.addEventListener('mouseleave', hideTooltip);

        // Touch Events (Mobile)
        hitArea.addEventListener('touchstart', (e) => {
            showTooltip(e);
            setTimeout(hideTooltip, 3000);
        }, { passive: true });

        group.appendChild(circle);
        group.appendChild(hitArea);
        svg.appendChild(group);
    });

    // X-Axis Labels (Simple 5 step)
    const labelsContainer = document.getElementById('graph-labels');
    labelsContainer.innerHTML = '';

    const step = Math.floor(times.length / 5);
    for (let i = 0; i < times.length; i += step) {
        const tObj = new Date(times[i]);
        const label = document.createElement('span');
        label.textContent = tObj.getHours() + ':00';
        labelsContainer.appendChild(label);
    }
}

function renderWeekly(daily) {
    weeklyList.innerHTML = '';

    for (let i = 0; i < daily.time.length; i++) {
        const date = new Date(daily.time[i]);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const max = Math.round(daily.temperature_2m_max[i]);
        const min = Math.round(daily.temperature_2m_min[i]);
        const code = daily.weather_code[i];

        // Use SVG icons for sidebar too
        const info = getWeatherMetadata(code, true);

        const row = document.createElement('div');
        row.className = 'day-item';
        // Note: we'll handle active class in selectDay
        if (i === currentDayIndex) row.classList.add('active');

        row.innerHTML = `
            <span class="day-name">${i === 0 ? 'Today' : dayName}</span>
            <div class="day-icon">
                <img src="${info.image}" alt="${info.description}">
            </div>
            <div class="day-temp">
                <span class="high">${max}°</span>
                <span class="low">${min}°</span>
            </div>
        `;

        row.addEventListener('click', () => selectDay(i));

        weeklyList.appendChild(row);
    }
}

function selectDay(index) {
    if (!globalWeatherData) return;
    currentDayIndex = index;
    const data = globalWeatherData;

    // 1. Update Sidebar Active State
    const items = weeklyList.querySelectorAll('.day-item');
    items.forEach((item, i) => {
        if (i === index) item.classList.add('active');
        else item.classList.remove('active');
    });

    // 2. Update Header Date
    const targetDate = new Date(data.daily.time[index]);
    // Adjust logic to handle timezone correctly or just force local interpret path
    // The string is YYYY-MM-DD. 
    // Creating 'new Date("YYYY-MM-DD")' is UTC usually.
    // Let's split to be safe.
    const [y, m, d] = data.daily.time[index].split('-');
    const dateObj = new Date(y, m - 1, d);

    currentDateEl.textContent = dateObj.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

    // 3. Update Hero Section
    if (index === 0) {
        // Show Current Source of Truth
        const current = data.current;
        heroTemp.textContent = Math.round(current.temperature_2m);
        heroWind.textContent = `${current.wind_speed_10m} km/h`;
        heroHumidity.textContent = `${current.relative_humidity_2m}%`;
        heroRain.textContent = `${current.precipitation} mm`;

        const weatherInfo = getWeatherMetadata(current.weather_code, current.is_day);
        heroCondition.textContent = weatherInfo.description;
        heroImage.src = weatherInfo.image;

        // Render graph from NOW
        renderGraph(data.hourly, true); // true = start from now
    } else {
        // Show Forecast Details
        const daily = data.daily;
        // For future, use Max Temp as the big number? Or average? Max is typical.
        heroTemp.textContent = Math.round(daily.temperature_2m_max[index]);
        heroWind.textContent = `${daily.wind_speed_10m_max[index]} km/h`;
        // Humidity is not daily aggregate usually, assume dash or hide? 
        // We don't have humidity in daily.
        heroHumidity.textContent = '--%';
        heroRain.textContent = `${daily.precipitation_sum[index]} mm`;

        const weatherInfo = getWeatherMetadata(daily.weather_code[index], true);
        heroCondition.textContent = weatherInfo.description;
        heroImage.src = weatherInfo.image;

        // Render Graph for that specific day (00-24)
        renderGraph(data.hourly, false, data.daily.time[index]);
    }
}

// 3D/Fluent Icon Mapping
function getWeatherMetadata(code, isDay) {
    // Using Basmilius Weather Icons (Open Source, Beautiful 3D style)
    // Base URL: https://raw.githubusercontent.com/basmilius/weather-icons/dev/design/fill/final/
    const baseUrl = 'https://raw.githubusercontent.com/basmilius/weather-icons/dev/design/fill/final/';

    let file = 'clear-day.svg';
    let desc = 'Clear Sky';

    if (code === 0) {
        file = isDay ? 'clear-day.svg' : 'clear-night.svg';
        desc = 'Clear Sky';
    } else if ([1, 2].includes(code)) {
        file = isDay ? 'partly-cloudy-day.svg' : 'partly-cloudy-night.svg';
        desc = 'Partly Cloudy';
    } else if (code === 3) {
        file = 'overcast.svg';
        desc = 'Overcast';
    } else if ([45, 48].includes(code)) {
        file = 'fog.svg';
        desc = 'Fog';
    } else if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
        file = 'rain.svg';
        desc = 'Rain';
    } else if ([71, 73, 75, 77, 85, 86].includes(code)) {
        file = 'snow.svg';
        desc = 'Snow';
    } else if ([95, 96, 99].includes(code)) {
        file = 'thunderstorms.svg';
        desc = 'Thunderstorm';
    }

    return {
        description: desc,
        image: baseUrl + file
    };
}
