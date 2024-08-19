// content.js
console.log("Content script loaded - Log ID: 001");
let isMinimized = true;
let currentUrl = window.location.href;
let isGoogleMaps = currentUrl.includes("/maps/");
let currentPlaceName = null;
let currentPlaceAddress = null;
let leaderboard = [];
const BASE_SCORE_API_URL =
  // "https://score-google-place-api-bnwzz3dieq-zf.a.run.app";
  "http://localhost:8000";
let isDebugMode = true; // Set this to false to turn off logging
let reviewModelScoreController = null;

function log(message) {
  if (isDebugMode) {
    console.log(message);
  }
}

function getPlaceName() {
  const titleElement = isGoogleMaps
    ? document.querySelector("h1.DUwDvf.lfPIob")
    : document.querySelector('[data-attrid="title"]');
  if (titleElement) {
    const placeName = titleElement.innerText;
    log(`Place name found: ${placeName} - Log ID: 002`);
    return placeName;
  } else {
    log("Place name not found - Log ID: 003");
    return null;
  }
}

function getPlaceAddress() {
  const addressElement = getAddressElement();
  if (addressElement && addressElement.children.length > 1) {
    const address = addressElement.children[1].innerText;
    log(`Address found: ${address} - Log ID: 007`);
    return address;
  } else {
    log("Address not found or insufficient children - Log ID: 008");
    return null;
  }
}

function getAddressElement() {
  return isGoogleMaps
    ? document.querySelector('button[data-item-id="address"]')?.children[0]
    : document.querySelector('[data-local-attribute="d3adr"]');
}

async function fetchReviewData(placeName, placeAddress) {
  if (reviewModelScoreController) {
    reviewModelScoreController.abort();
  }
  reviewModelScoreController = new AbortController();
  const { signal } = reviewModelScoreController;

  const apiUrl = `${BASE_SCORE_API_URL}/get_review_data?place_name=${encodeURIComponent(
    `${placeName} ${placeAddress.split(",")[0]}`
  )}&address=${placeAddress}&number_of_reviews=50`;

  showSkeletonLoader();

  try {
    const response = await fetch(apiUrl, { signal });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    log(
      `Received data: score=${data.score}, summary=${data.summary} - Log ID: 017`
    );
    displayReviewModelScore(data.score);
    displayPlaceSummary(data.summary);
    displayBestWorstReviews(data.best_review, data.worst_review);

    leaderboard.push(data);
    leaderboard.sort((a, b) => b.score - a.score);
    displayLeaderboard(leaderboard);
  } catch (error) {
    if (error.name === "AbortError") {
      log(`Fetch aborted for review data - Log ID: 018`);
    } else {
      log(`Failed to fetch review data - Log ID: 018`, error);
    }
  }
}

function showSkeletonLoader() {
  const reviewModelScoreContainer = document.getElementById("reviewModelScore");
  const placeSummaryContainer = document.getElementById(
    "placeSummaryContainer"
  );
  const bestReviewContainer = document.getElementById("bestReview");
  const worstReviewContainer = document.getElementById("worstReview");
  const placeSummary = document.getElementById("placeSummary");
  reviewModelScoreContainer.innerHTML = `
    <div class="skeleton-container">
      <div class="loader"></div>

      <div class="skeleton-stars">
        <div class="skeleton-glimmer"></div>
      </div>
    </div>
  `;

  bestReviewContainer.innerHTML = `
  <div class="best-worst-load skeleton"></div>
  `;
  worstReviewContainer.innerHTML = `
  <div class="best-worst-load skeleton"></div>
  `;

  placeSummaryContainer.classList.add("skeleton");
  placeSummary.innerHTML = "";
}

function createTruncatedReview(review) {
  const truncatedText =
    review.length > 50 ? review.substring(0, 50) + "..." : review;
  const fullText = review;
  const showMoreLink = '<a href="#" class="toggle-review">Show more</a>';

  return `<div class="review-text" data-full-text="${fullText}" data-truncated-text="${truncatedText}">
              "${truncatedText}" ${showMoreLink}
          </div>`;
}

function displayReviewModelScore(score) {
  const reviewModelScoreContainer = document.getElementById("reviewModelScore");

  const starHtml = generateStarHtml(score);

  reviewModelScoreContainer.innerHTML = `<div>${score} ${starHtml}</div>`;
}

function displayPlaceSummary(summary) {
  const placeSummaryContainer = document.getElementById(
    "placeSummaryContainer"
  );
  placeSummaryContainer.classList.remove("skeleton");
  const placeSummary = document.getElementById("placeSummary");
  const htmlContent = marked.parse(summary); // Convert Markdown to HTML
  placeSummary.innerHTML = htmlContent;
}

function displayBestWorstReviews(bestReview, worstReview) {
  const bestReviewContainer = document.getElementById("bestReview");
  const worstReviewContainer = document.getElementById("worstReview");

  bestReviewContainer.innerHTML = `
    <div>
      <div>
        <span>${bestReview.score}</span> 
        ${generateStarHtml(bestReview.score)} 
      </div>
      ${createTruncatedReview(bestReview.review)}
    </div>
  `;

  worstReviewContainer.innerHTML = `
    <div>
      <div>
        <span>${worstReview.score}</span> 
        ${generateStarHtml(worstReview.score)} 
      </div>
      ${createTruncatedReview(worstReview.review)}
    </div>
  `;

  addShowMoreShowLessListeners();
}

function addShowMoreShowLessListeners() {
  // Add event listeners for "show more" and "show less" links
  document.querySelectorAll(".toggle-review").forEach((link) => {
    link.addEventListener("click", toggleShowMoreShowLess);
  });
}

function toggleShowMoreShowLess(e) {
  e.preventDefault();
  const reviewTextElement = this.parentElement;
  const isExpanded = this.textContent === "Show less";

  if (isExpanded) {
    reviewTextElement.innerHTML =
      `"${reviewTextElement.getAttribute("data-truncated-text")}"` +
      ' <a href="#" class="toggle-review">Show more</a>';
  } else {
    reviewTextElement.textContent = `"${reviewTextElement.getAttribute(
      "data-full-text"
    )}"`;
    reviewTextElement.innerHTML +=
      ' <a href="#" class="toggle-review">Show less</a>';
  }

  // Re-add the event listener to the new link
  reviewTextElement
    .querySelector(".toggle-review")
    .addEventListener("click", toggleShowMoreShowLess);
}

function displayLeaderboard(placesLeaderboard) {
  const leaderboardContainer = document.getElementById("leaderboardContainer");

  const leaderboardList = placesLeaderboard.reduce(
    (acc, place, index) =>
      (acc += `
    <li class="flex s-e a-i-c">
      <span>${index + 1}. <b>${place.place_name}</b></span>
      <div class="t-n-w">
        ${place.score} ${generateStarHtml(place.score)}
      </div>
    </li>
  `),
    ""
  );

  leaderboardContainer.innerHTML = `<ol>${leaderboardList}</ol>`;
}

function generateStarHtml(score) {
  const starWidth = 23; // Width of one star
  const filledWidth = Math.max(
    starWidth,
    Math.floor(score) * starWidth + (score % 1) * starWidth
  );

  return `
    <span class="stars" aria-label="Rated ${score} out of 5," role="img">
      <div aria-hidden="true">
        <span style="width:calc(${filledWidth}px)"></span>
      </div>
    </span>
  `;
}

async function injectHTML() {
  try {
    const [styles, html] = await Promise.all([
      fetch(chrome.runtime.getURL("styles.css")),
      fetch(chrome.runtime.getURL("popup.html")),
    ]);
    const [stylesText, htmlText] = await Promise.all([
      styles.text(),
      html.text(),
    ]);

    const container = document.createElement("div");
    container.innerHTML = htmlText;
    const parentDiv = isGoogleMaps
      ? document.getElementById("QA0Szd")?.children[0]?.children[0]?.children[0]
      : document.getElementById("lu_pinned_rhs");
    if (parentDiv) {
      const styles = document.createElement("style");
      styles.innerText = stylesText;
      container.appendChild(styles);
      parentDiv.appendChild(container);
      log("HTML injected - Log ID: 011");
      initializePopup();
    } else {
      log("Parent div not found - Log ID: 012");
    }
  } catch (err) {
    log("Failed to fetch HTML - Log ID: 013", err);
  }
}

function initializePopup() {
  log("Initializing popup - Log ID: 020");

  updatePlaceInfo();

  document
    .getElementById("reviewBuddyMinimizeButton")
    .addEventListener("click", (event) => {
      event.stopPropagation(); // Prevent the click event from bubbling up to the parent div
      document.getElementById("reviewBuddyContent").style.display = "none";
      document.getElementById("reviewBuddyMinimizeButton").style.display =
        "none";
      isMinimized = true;
      log("Minimized - Log ID: 015");
    });

  document
    .getElementById("reviewBuddyContainer")
    .addEventListener("click", () => {
      if (isMinimized) {
        document.getElementById("reviewBuddyContent").style.display = "block";
        document.getElementById("reviewBuddyMinimizeButton").style.display =
          "block";
        isMinimized = false;
        log("Maximized - Log ID: 016");
      }
    });
  // Initialize tooltips
  document.querySelectorAll(".info-icon").forEach((icon) => {
    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    tooltip.innerText =
      "The rating is inferred using artificial intelligence reading over all of these reviews and giving a review based on the sentiment of the text, not by the stars they gave.";
    icon.appendChild(tooltip);
  });

  // Add event listener for summary toggle
  document
    .getElementById("placeSummaryContainer")
    .addEventListener("click", (event) => {
      event.stopPropagation(); // Prevent the click event from bubbling up to the parent div
      const summaryElement = event.target.closest(".summary-button");
      const arrowElement = document.getElementById("toggleArrow");
      summaryElement.classList.toggle("expanded");
      if (summaryElement.classList.contains("expanded")) {
        arrowElement.style.transform = "rotate(180deg)";
      } else {
        arrowElement.style.transform = "rotate(0deg)";
      }
    });

  // Adding functionality for animated tabs between Overview and Best & Worst reviews
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");

  // Function to show the tab content based on the active button
  function showTab(tab) {
    tabContents.forEach((content) => {
      content.classList.remove("active");
    });
    document.getElementById(tab).classList.add("active");
  }

  // Event listeners for each tab button
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Set active class on the clicked tab
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      // Show the corresponding tab content
      showTab(button.dataset.tab);
    });
  });
}

function updatePlaceInfo() {
  log("Updating place info - Log ID: 021");
  const placeName = getPlaceName();
  const placeAddress = getPlaceAddress();

  if (placeName) {
    document.getElementById("placeName").innerText = placeName;
    log(`Place name displayed: ${placeName} - Log ID: 005`);
    currentPlaceName = placeName;
  } else {
    document.getElementById("placeName").innerText = "Place name not found.";
    log("Failed to display place name - Log ID: 006");
  }

  if (placeAddress) {
    document.getElementById("placeAddress").innerText = placeAddress;
    log(`Address displayed: ${placeAddress} - Log ID: 009`);
    currentPlaceAddress = placeAddress;
    fetchReviewData(placeName, placeAddress);
  } else {
    document.getElementById("placeAddress").innerText = "Address not found.";
    log("Failed to display address - Log ID: 010");
  }
}

function waitForElements() {
  log("Waiting for elements - Log ID: 022");
  const observer = new MutationObserver((mutations, obs) => {
    const titleElement = getTitleElement();
    const addressElement = getAddressElement();
    if (titleElement && addressElement && addressElement.children.length > 1) {
      log("Required elements found - Log ID: 014");
      injectHTML();
      obs.disconnect();
      observePlaceChanges();
    }
  });

  observer.observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function observePlaceChanges() {
  log("Observing place changes - Log ID: 023");
  const titleElement = getTitleElement();
  const addressElement = getAddressElement();
  const placeElement = document.querySelector('div[data-async-type="lcl_akp"]');

  const observer = new MutationObserver((mutations) => {
    log("Place information changed - Log ID: 019");
    mutations.forEach((mutation) => {
      log(`Mutation detected: ${mutation.type} - Log ID: 026`);
    });
    updatePlaceInfo();
  });

  if (placeElement) {
    observer.observe(placeElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  if (titleElement) {
    observer.observe(titleElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    log("Observing title element - Log ID: 024");
  }

  if (addressElement) {
    observer.observe(addressElement.children[1], {
      childList: true,
      subtree: true,
      characterData: true,
    });
    log("Observing address element - Log ID: 025");
  }
}

function detectUrlChange() {
  setInterval(() => {
    if (currentUrl !== window.location.href) {
      log(
        `URL changed from ${currentUrl} to ${window.location.href} - Log ID: 027`
      );
      currentUrl = window.location.href;
      retryUpdatePlaceInfo();
    }
  }, 1000);
}

function retryUpdatePlaceInfo(retries = 5) {
  log(`Retrying update place info, attempts left: ${retries} - Log ID: 028`);
  if (retries <= 0) {
    log("Max retries reached, stopping retry - Log ID: 029");
    return;
  }

  const titleElement = getTitleElement();
  const addressElement = getAddressElement();

  if (titleElement && addressElement && addressElement.children.length > 1) {
    const newPlaceName = titleElement.innerText;
    const newPlaceAddress = addressElement.children[1].innerText;

    if (
      newPlaceName !== currentPlaceName ||
      newPlaceAddress !== currentPlaceAddress
    ) {
      log(
        `New place detected: ${newPlaceName}, ${newPlaceAddress} - Log ID: 030`
      );
      resetState();
      updatePlaceInfo();
    } else {
      log(`Place info not changed yet, retrying... - Log ID: 031`);
      setTimeout(() => retryUpdatePlaceInfo(retries - 1), 1000);
    }
  } else {
    setTimeout(() => retryUpdatePlaceInfo(retries - 1), 1000);
  }
}

function getTitleElement() {
  return isGoogleMaps
    ? document.querySelector("h1.DUwDvf.lfPIob")
    : document.querySelector('[data-attrid="title"]');
}

function resetState() {
  currentPlaceName = null;
  currentPlaceAddress = null;
  showSkeletonLoader();
  if (reviewModelScoreController) {
    reviewModelScoreController.abort();
  }
}

waitForElements();
detectUrlChange();
