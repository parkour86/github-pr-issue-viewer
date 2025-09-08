$(document).ready(function () {
  let allPRs = [];
  let allIssues = [];
  let activeTab = "pr"; // "pr" or "issue"

  // --- THEME TOGGLE LOGIC START ---
  /* prettier-ignore */
  function setTheme(theme) {
    // Remove existing theme stylesheet(s)
    $("link[rel=stylesheet]").each(function () {
      const href = $(this).attr("href");
      if (href && (href.includes("styles_dark.css") || href.includes("styles_light.css"))) {
        $(this).remove();
      }
    });
    // Add the new theme stylesheet
    const themeHref = theme === "light" ? "styles_light.css" : "styles_dark.css";
    $("<link>", {
      rel: "stylesheet",
      href: themeHref,
    }).appendTo("head");
    // Save preference
    localStorage.setItem("theme", theme);
    // Optionally update icon
    updateThemeIcon(theme);
  }

  function updateThemeIcon(theme) {
    const $icon = $("#themeToggleIcon");
    if (theme === "light") {
      // Sun icon (yellow fill, dark stroke)
      $icon.find("circle").attr("fill", "#FFD700");
      $icon.attr("stroke", "#24292e");
    } else {
      // Moon icon (dark fill, light stroke)
      $icon.find("circle").attr("fill", "#22272d");
      $icon.attr("stroke", "#e3e8ef");
    }
  }

  function getPreferredTheme() {
    // Check localStorage, fallback to dark
    return localStorage.getItem("theme") || "dark";
  }

  // On load, set theme
  setTheme(getPreferredTheme());

  $("#themeToggleBtn").on("click", function () {
    const currentTheme = localStorage.getItem("theme") || "dark";
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  });
  // --- THEME TOGGLE LOGIC END ---

  // Keep filter states locally
  let filterStates = {
    Open: true,
    Merged: true,
    Closed: false,
  };

  async function fetchPRs() {
    const username = $("#username").val().trim();
    const $prList = $("#prList");
    const $showPrsBtn = $("#showPrsBtn");

    $prList.html("<li>Loading...</li>");
    allPRs = [];
    allIssues = [];
    $showPrsBtn.prop("disabled", true);

    if (!username) {
      $prList.html("");
      $showPrsBtn.prop("disabled", false);
      return;
    }

    const url = `https://api.github.com/search/issues?q=author:${encodeURIComponent(username)}&sort=created&order=desc`;
    const resp = await fetch(url);
    if (!resp.ok) {
      $prList.html(`<li>Error fetching issues/PRs for user "${username}"</li>`);
      $showPrsBtn.prop("disabled", false);
      return;
    }
    const data = await resp.json();
    if (!data.items || data.items.length === 0) {
      $prList.html(
        `<li>No issues or pull requests found for "${username}"</li>`,
      );
      $showPrsBtn.prop("disabled", false);
      return;
    }

    for (const item of data.items) {
      const repo = item.repository_url.split("/").slice(-2).join("/");
      let status,
        statusClass = "";

      if (item.pull_request) {
        if (item.pull_request.merged_at) {
          status = "Merged";
          statusClass = "status-merged";
        } else if (item.state === "open") {
          status = "Open";
          statusClass = "status-open";
        } else {
          status = "Closed";
          statusClass = "status-closed";
        }
        allPRs.push({
          html_url: item.html_url,
          title: item.title,
          repo,
          status,
          statusClass,
          created_at: item.created_at,
        });
      } else {
        status = item.state === "open" ? "Open" : "Closed";
        statusClass = status === "Open" ? "status-open" : "status-closed";
        allIssues.push({
          html_url: item.html_url,
          title: item.title,
          repo,
          status,
          statusClass,
          created_at: item.created_at,
        });
      }
    }

    renderTabbed();
    $showPrsBtn.prop("disabled", false);
  }

  function renderTabbed() {
    const $prList = $("#prList");

    // Calculate filtered counts for tabs
    const visiblePRs = allPRs.filter(
      (item) => filterStates[item.status],
    ).length;
    const visibleIssues = allIssues.filter(
      (item) => filterStates[item.status],
    ).length;

    let tabHtml = `
      <div class="tab-bar">
        <button class="tab-btn${activeTab === "pr" ? " active" : ""}" id="tab-pr">Pull Requests (${visiblePRs})</button>
        <button class="tab-btn${activeTab === "issue" ? " active" : ""}" id="tab-issue">Issues (${visibleIssues})</button>
      </div>
    `;
    $prList.html(tabHtml);

    // Render filter group inside .controls
    let filterGroupHtml = `
      <div class="filter-bar">
        <div class="filter-group">
          <span class="filter-label">Filter:</span>
          <button class="filter-btn ${filterStates.Open ? "selected" : ""}" data-status="Open" id="filter-open">Open</button>
          <button class="filter-btn ${filterStates.Merged ? "selected" : ""}" data-status="Merged" id="filter-merged" style="${activeTab === "pr" ? "" : "visibility:hidden;"}">Merged</button>
          <button class="filter-btn ${filterStates.Closed ? "selected" : ""}" data-status="Closed" id="filter-closed">Closed</button>
        </div>
      </div>
    `;
    // Remove any previous filter group before adding a new one
    $(".controls .filter-bar").remove();
    $(".controls").append(filterGroupHtml);

    let dataToRender = activeTab === "pr" ? [...allPRs] : [...allIssues];

    // Apply filter
    dataToRender = dataToRender.filter((item) => {
      if (item.status === "Merged" && activeTab !== "pr") return false;
      return !!filterStates[item.status];
    });

    // Always sort newest to oldest
    dataToRender.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    );

    // Render list
    let listHtml = '<ul class="pr-list">';
    if (dataToRender.length === 0) {
      listHtml += `<li>No ${activeTab === "pr" ? "pull requests" : "issues"} found.</li>`;
    } else {
      dataToRender.forEach((item) => {
        const date = new Date(item.created_at);
        const dateStr = date.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        listHtml += `<li class="${item.statusClass}">
          <a href="${item.html_url}" target="_blank">${item.title}</a>
          <div class="repo">${item.repo.length > 50 ? item.repo.slice(0, 50) + "..." : item.repo}</div>
          <div class="status"><strong>Status:</strong> ${item.status}</div>
          <div class="created" title="Created Date">${dateStr}</div>
        </li>`;
      });
    }
    listHtml += "</ul>";
    $prList.append(listHtml);

    // Tab switching
    $(".tab-btn")
      .off("click")
      .on("click", function () {
        activeTab = $(this).attr("id") === "tab-pr" ? "pr" : "issue";
        renderTabbed();
      });

    // Filter buttons
    $(".filter-btn")
      .off("click")
      .on("click", function () {
        const status = $(this).data("status");
        filterStates[status] = !filterStates[status];
        renderTabbed();
      });
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  $("#showPrsBtn").on("click", fetchPRs);
  $("#username").on("keydown", (e) => {
    if (e.key === "Enter") fetchPRs();
  });
});
