let mapInstance;
let markerInstance;
let lastSatelliteImage;
let satelliteImageContainer;
let weatherDataList = [];
const regionManager = new CountriesAndRegions();
const ignoredWords = [
  "kommun", "Kommune", "Municipality", "municipality", "Town of ",
  "City of ", "District", "district", "County", "Region of "
];

// Initialize the Google Map
function initializeMap() {
  const mapOptions = {
    scrollwheel: true,
    mapTypeControl: false,
    zoomControl: true,
    center: new google.maps.LatLng(55.6050, 13.0038),
    zoom: 9,
    streetViewControl: false,
    styles: [
      { elementType: "geometry", stylers: [{ color: "#306844" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
      { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] }
    ],
  };

  mapInstance = new google.maps.Map(document.getElementById("googleMap"), mapOptions);
  initializeMarker();

  mapInstance.addListener("click", (event) => {
    const latLngString = event.latLng.toString();
    const [lat, lng] = latLngString.replace(/[(),]/g, '').split(' ');

    clearWeatherData();
    fetchWeatherData(lat, lng);
    markerInstance.setPosition(event.latLng);
  });
}

// Fetch weather information based on latitude and longitude
async function fetchWeatherData(latitude, longitude) {
  try {
    await fetchSatelliteImage(Math.round(latitude), Math.round(longitude));
    const apiUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=MY_KEY`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    weatherDataList.push(`<li id="listItem">Current weather: ${data.weather[0].description}</li>`);
    weatherDataList.push(`<li id="listItem">Temperature: ${data.main.temp}</li>`);
    weatherDataList.push(`<li id="listItem">Max temperature: ${data.main.temp_max}</li>`);
    weatherDataList.push(`<li id="listItem">Min temperature: ${data.main.temp_min}</li>`);
    weatherDataList.push(`<li id="listItem">Humidity: ${data.main.humidity}</li>`);

    if (!data.name || data.name.length === 0) {
      displayInfo("No Wikipedia article!", "Please choose a different place!");
    } else {
      const country = regionManager.getCountryOrRegionName(data.sys.country);
      const reverseGeoResponse = await fetch(`http://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=5&appid=MY_KEY`);
      const reverseGeoData = await reverseGeoResponse.json();
      const stateRegion = reverseGeoData[0]?.state || null;

      filterPlaceName(data.name, country, stateRegion);
      const weatherIcon = {
        url: `http://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`,
        scaledSize: new google.maps.Size(80, 80)
      };
      markerInstance.setIcon(weatherIcon);
    }
  } catch (error) {
    console.error("Error fetching weather data:", error);
  }
}

// Display the fetched weather information
function displayWeatherInfo() {
  const weatherList = $("#searchList");
  weatherDataList.forEach(item => {
    weatherList.append(item);
  });
}

// Filter and format place names for Wikipedia search
function filterPlaceName(place, country, region) {
  const placeIgnoredWords = ["City", "Town", "Village", "Province", "State"];
  placeIgnoredWords.forEach(word => {
    if (place.includes(word)) {
      place = place.replace(word, '');
    }
  });
  country = country.replace(/ *\([^)]*\) */g, ""); // Remove parentheses
  fetchWikipediaArticle(place, region, country);
}

// Fetch Wikipedia article with region name
async function fetchWikipediaArticle(place, region, country) {
  const url = `https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro=&explaintext=&titles=${place},_${region}&rvprop=coordinates&callback=?`;
  try {
    const data = await $.getJSON(url);
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];

    if (pages[pageId]['extract']?.length) {
      displayInfo(pages[pageId].title, pages[pageId]['extract']);
    } else {
      fetchWikipediaEntry(place, region, country); // Try without the region name
    }
  } catch (error) {
    console.error(error);
  }
}

// Fetch Wikipedia entry for the place
async function fetchWikipediaEntry(place, region, country) {
  const url = `https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro=&explaintext=&titles=${place}&rvprop=coordinates&callback=?`;
  try {
    const data = await $.getJSON(url);
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];

    if (pages[pageId]['extract']?.length && !pages[pageId]['extract'].includes("refer to ") && !pages[pageId]['extract'].includes("refers to ") && containsCountryOrRegion(pages[pageId]['extract'], country, region)) {
      displayInfo(pages[pageId].title, pages[pageId]['extract']);
    } else {
      fetchRegionWikipediaArticle(region, country); // Try region article
    }
  } catch (error) {
    console.error(error);
  }
}

// Fetch Wikipedia article for the region
async function fetchRegionWikipediaArticle(region, country) {
  const url = `https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro=&explaintext=&titles=${region}&rvprop=coordinates&callback=?`;
  try {
    const data = await $.getJSON(url);
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];

    if (pages[pageId]['extract']?.length && !pages[pageId]['extract'].includes("refer to ") && !pages[pageId]['extract'].includes("refers to ") && containsCountryOrRegion(pages[pageId]['extract'], country, null)) {
      displayInfo(pages[pageId].title, pages[pageId]['extract']);
    } else {
      fetchCountryWikipediaArticle(country); // Try country article
    }
  } catch (error) {
    console.error(error);
  }
}

// Fetch Wikipedia article for the country
async function fetchCountryWikipediaArticle(country) {
  const url = `https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro=&explaintext=&titles=${country}&rvprop=coordinates&callback=?`;
  try {
    const data = await $.getJSON(url);
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];

    if (pages[pageId]['extract']?.length) {
      displayInfo(pages[pageId].title, pages[pageId]['extract']);
    } else {
      displayInfo("Sorry", "We couldn't find any Wikipedia article! Please choose a different place!");
    }
  } catch (error) {
    console.error(error);
  }
}

// Display information about the place and weather
function displayInfo(title, content) {
  document.getElementById("placeName").textContent = title;
  document.getElementById("wikiText").textContent = content;
  displayWeatherInfo();
  weatherDataList = []; // Clear weather data
  satelliteImageContainer.appendChild(lastSatelliteImage); // Show satellite image
}

// Check if the Wikipedia article contains references to the country or region
function containsCountryOrRegion(text, country, region) {
  return text.includes(country) || text.includes(region);
}

// Initialize the marker on the map
function initializeMarker() {
  markerInstance = new google.maps.Marker({
    map: mapInstance,
    position: new google.maps.LatLng(55.6050, 13.0038)
  });
}

// Clear the weather data and UI
function clearWeatherData() {
  const weatherList = document.getElementById("searchList");
  while (weatherList.firstChild) {
    weatherList.removeChild(weatherList.firstChild);
  }
  document.getElementById("wikiText").textContent = '';
  document.getElementById("placeName").textContent = '';
}

// Fetch the satellite image based on coordinates
async function fetchSatelliteImage(lat, lon) {
  const imgUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lon}&zoom=9&size=700x700&maptype=satellite&key=MY_KEY`;
  lastSatelliteImage = document.createElement("img");
  lastSatelliteImage.src = imgUrl;
  lastSatelliteImage.alt = "Satellite image of the selected location";
  satelliteImageContainer = document.getElementById("satelliteImage");
  satelliteImageContainer.innerHTML = ''; // Clear previous image
  satelliteImageContainer.appendChild(lastSatelliteImage);
}

// Load the map once the API is ready
function loadMap() {
  google.maps.event.addDomListener(window, 'load', initializeMap);
}
