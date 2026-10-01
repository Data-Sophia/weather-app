const API_BASE = "https://api.open-meteo.com/v1/forecast";
const GEO_BASE = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_CODES = {
  0: ["Clear sky", "sun"], 1: ["Mainly clear", "sun"], 2: ["Partly cloudy", "partly"], 3: ["Overcast", "cloud"],
  45: ["Foggy", "fog"], 48: ["Rime fog", "fog"], 51: ["Light drizzle", "rain"], 53: ["Drizzle", "rain"], 55: ["Dense drizzle", "rain"],
  56: ["Freezing drizzle", "rain"], 57: ["Freezing drizzle", "rain"], 61: ["Light rain", "rain"], 63: ["Rain", "rain"], 65: ["Heavy rain", "rain"],
  66: ["Freezing rain", "rain"], 67: ["Heavy freezing rain", "rain"], 71: ["Light snow", "snow"], 73: ["Snow", "snow"], 75: ["Heavy snow", "snow"],
  77: ["Snow grains", "snow"], 80: ["Light showers", "rain"], 81: ["Showers", "rain"], 82: ["Heavy showers", "rain"], 85: ["Snow showers", "snow"],
  86: ["Heavy snow showers", "snow"], 95: ["Thunderstorm", "storm"], 96: ["Thunderstorm and hail", "storm"], 99: ["Thunderstorm and hail", "storm"]
};
const el = { weather: document.querySelector("#weather-content"), status: document.querySelector("#status-message"), search: document.querySelector("#search-form"), input: document.querySelector("#city-search"), units: document.querySelector("#unit-toggle"), locate: document.querySelector("#locate-button") };
let selectedLocation = null;
let unit = "celsius";

function info(code) { return WEATHER_CODES[code] || ["Changing skies", "partly"]; }
function icon(kind) {
  const sun = '<circle cx="40" cy="40" r="16" fill="#f4bd69"/><g stroke="#e9ad5c" stroke-width="3" stroke-linecap="round"><path d="M40 10v6m0 48v6M10 40h6m48 0h6M19 19l4 4m34 34 4 4m0-42-4 4M23 57l-4 4"/></g>';
  const cloud = '<path d="M28 61h42a16 16 0 0 0 0-32 23 23 0 0 0-44-2 18 18 0 0 0 2 34Z" fill="#f8faf5" stroke="#a8bcb1" stroke-width="3" stroke-linejoin="round"/>';
  let art = kind === "sun" ? sun : kind === "partly" ? sun + cloud.replaceAll("M28 61", "M27 67").replaceAll("h42", "h42") : cloud;
  if (kind === "fog") art += '<path d="M25 70h43m-37 9h34" stroke="#8ca79b" stroke-width="4" stroke-linecap="round"/>';
  if (kind === "rain" || kind === "snow") art += '<path d="m37 69-4 10m19-10-4 10m19-10-4 10" stroke="#74a8b7" stroke-width="4" stroke-linecap="round"/>';
  if (kind === "storm") art += '<path d="m48 58-9 16h10l-4 12 17-20H51l6-8Z" fill="#e9b451"/>';
  return `<svg viewBox="0 0 88 88" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${art}</svg>`;
}
function temp(value) { return Math.round(unit === "celsius" ? value : value * 9 / 5 + 32); }
function time(value) { return new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function date(value, options) { return new Intl.DateTimeFormat([], options).format(new Date(`${value}T12:00:00`)); }
function text(id, value) { document.querySelector(id).textContent = value; }
function windDirection(degrees) { return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(degrees / 45) % 8]; }
function uvDescription(value) { return value < 3 ? "Low" : value < 6 ? "Moderate" : value < 8 ? "High" : value < 11 ? "Very high" : "Extreme"; }

function render(data) {
  const current = data.current;
  const daily = data.daily;
  const [condition, kind] = info(current.weather_code);
  document.querySelector("#hero-weather-icon").innerHTML = icon(kind);
  text("#location-name", selectedLocation.name);
  text("#current-condition", condition);
  text("#current-temperature", temp(current.temperature_2m));
  text("#today-high", `${temp(daily.temperature_2m_max[0])}°`);
  text("#today-low", `${temp(daily.temperature_2m_min[0])}°`);
  text("#current-date", date(daily.time[0], { weekday: "long", month: "long", day: "numeric" }).toUpperCase());
  text("#forecast-date", `${date(daily.time[0], { month: "short", day: "numeric" })} – ${date(daily.time[5], { month: "short", day: "numeric" })}`);
  text("#sunrise-time", time(daily.sunrise[0]));
  text("#sunset-time", time(daily.sunset[0]));
  text("#feels-like", `${temp(current.apparent_temperature)}°`);
  text("#feels-description", current.apparent_temperature < current.temperature_2m - 3 ? "A little sheltered" : current.apparent_temperature > current.temperature_2m + 3 ? "Warmer in the sun" : "In the shade");
  const windSpeed = unit === "celsius" ? current.wind_speed_10m : current.wind_speed_10m * 0.621371;
  document.querySelector("#wind-speed").innerHTML = `${Math.round(windSpeed)} <small>${unit === "celsius" ? "km/h" : "mph"}</small>`;
  text("#wind-direction", `${windDirection(current.wind_direction_10m)} wind`);
  text("#humidity", `${current.relative_humidity_2m}%`);
  text("#humidity-description", current.relative_humidity_2m > 70 ? "Humid" : current.relative_humidity_2m < 35 ? "Dry air" : "Comfortable");
  text("#uv-index", `${Math.round(daily.uv_index_max[0])}`);
  text("#uv-description", uvDescription(daily.uv_index_max[0]));
  const daylight = Math.round((new Date(daily.sunset[0]) - new Date(daily.sunrise[0])) / 60000);
  text("#daylight-duration", `${Math.floor(daylight / 60)}h ${daylight % 60}m`);
  text("#footer-location", `${selectedLocation.name.toUpperCase()} WEATHER`);
  const min = Math.min(...daily.temperature_2m_min);
  const range = Math.max(1, Math.max(...daily.temperature_2m_max) - min);
  document.querySelector("#forecast-list").innerHTML = daily.time.slice(0, 6).map((day, index) => {
    const [description, weather] = info(daily.weather_code[index]);
    const low = daily.temperature_2m_min[index], high = daily.temperature_2m_max[index], rain = daily.precipitation_probability_max[index];
    const offset = (low - min) / range * 100, width = Math.max(6, (high - low) / range * 100);
    const name = index ? date(day, { weekday: "short" }) : "Today";
    return `<div class="forecast-day" aria-label="${name}, ${description}, high ${temp(high)} degrees, low ${temp(low)} degrees"><span class="forecast-day-name">${name}<small>${index ? date(day, { month: "short", day: "numeric" }) : ""}</small></span><span class="forecast-icon">${icon(weather)}</span><span class="rain-chance ${rain < 10 ? "rain-empty" : ""}">↓ ${rain}%</span><span class="range-track"><span class="range-fill" style="left:${offset}%;width:${width}%"></span></span><span class="day-low">${temp(low)}°</span><span class="day-high">${temp(high)}°</span></div>`;
  }).join("");
  document.querySelector("[data-unit='celsius']").classList.toggle("is-active", unit === "celsius");
  document.querySelector("[data-unit='fahrenheit']").classList.toggle("is-active", unit === "fahrenheit");
  el.weather.hidden = false;
  text("#updated-label", `UPDATED ${time(current.time)}`.toUpperCase());
}

async function loadWeather(place) {
  selectedLocation = place;
  el.status.textContent = "";
  el.weather.hidden = true;
  text("#updated-label", "FETCHING LOCAL WEATHER");
  const params = new URLSearchParams({ latitude: place.latitude, longitude: place.longitude, timezone: "auto", forecast_days: "6", temperature_unit: "celsius", wind_speed_unit: "kmh", current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m", daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max" });
  try {
    const response = await fetch(`${API_BASE}?${params}`);
    if (!response.ok) throw new Error("Weather service unavailable. Please try again shortly.");
    render(await response.json());
  } catch (error) {
    el.status.textContent = error.message || "Could not load weather. Check your connection and try again.";
    text("#updated-label", "WEATHER UNAVAILABLE");
  }
}
async function searchPlace(query) {
  el.status.textContent = "";
  text("#updated-label", "FINDING YOUR PLACE");
  try {
    const response = await fetch(`${GEO_BASE}?${new URLSearchParams({ name: query, count: "1", language: navigator.language.slice(0, 2), format: "json" })}`);
    if (!response.ok) throw new Error("Location search is unavailable. Try again shortly.");
    const results = (await response.json()).results;
    if (!results?.length) throw new Error(`We couldn't find “${query}”. Try another city or town.`);
    const place = results[0];
    const parts = [place.name, place.admin1, place.country].filter((value, index, list) => value && list.indexOf(value) === index);
    await loadWeather({ name: parts.join(", "), latitude: place.latitude, longitude: place.longitude });
  } catch (error) {
    el.status.textContent = error.message || "Location search failed. Check your connection and try again.";
    text("#updated-label", "SEARCH UNAVAILABLE");
  }
}
function useLocation() {
  if (!navigator.geolocation) { el.status.textContent = "Location is not available in this browser. Search for a city instead."; return; }
  el.status.textContent = "";
  text("#updated-label", "FINDING YOUR LOCATION");
  navigator.geolocation.getCurrentPosition(async ({ coords }) => {
    try {
      const response = await fetch(`${GEO_BASE}?${new URLSearchParams({ latitude: coords.latitude, longitude: coords.longitude, count: "1", language: navigator.language.slice(0, 2), format: "json" })}`);
      const place = (await response.json()).results?.[0];
      await loadWeather({ name: place ? [place.name, place.admin1].filter(Boolean).join(", ") : "Your location", latitude: coords.latitude, longitude: coords.longitude });
    } catch { loadWeather({ name: "Your location", latitude: coords.latitude, longitude: coords.longitude }); }
  }, () => { el.status.textContent = "Location access was unavailable. Search for a city or town instead."; text("#updated-label", "LOCATION UNAVAILABLE"); }, { timeout: 10000 });
}

el.search.addEventListener("submit", event => { event.preventDefault(); const query = el.input.value.trim(); if (query) searchPlace(query); });
el.units.addEventListener("click", () => { unit = unit === "celsius" ? "fahrenheit" : "celsius"; if (selectedLocation) loadWeather(selectedLocation); });
el.locate.addEventListener("click", useLocation);
searchPlace("Seattle");
