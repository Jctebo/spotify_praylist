const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "America/Chicago",
});

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function safeSpotifyUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "open.spotify.com" ? url.href : null;
  } catch {
    return null;
  }
}

function spotifyLink(url, label, className = "") {
  const safeUrl = safeSpotifyUrl(url);
  const link = element("a", className, label);
  if (!safeUrl) {
    link.setAttribute("aria-disabled", "true");
    link.classList.add("link-disabled");
    return link;
  }
  link.href = safeUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function renderGroup(group) {
  const section = element("section", "playlist-card");
  section.id = `group-${group.key}`;
  section.setAttribute("aria-labelledby", `heading-${group.key}`);

  const top = element("div", "playlist-card-top");
  const heading = element("h3", "playlist-title", group.name);
  heading.id = `heading-${group.key}`;
  const count = element("span", "prayer-count", `${group.prayers.length} ${group.prayers.length === 1 ? "prayer" : "prayers"}`);
  top.append(heading, count);
  section.append(top);

  if (!group.prayers.length) {
    section.append(element("p", "empty-message", "No prayers are scheduled here today."));
  } else {
    const list = element("ol", "prayer-list");
    for (const prayer of group.prayers) {
      const item = element("li", "prayer-item");
      const link = spotifyLink(prayer.spotify_url, prayer.name, "prayer-link");
      link.append(element("span", "link-arrow", "↗"));
      item.append(link);
      list.append(item);
    }
    section.append(list);
  }

  section.append(spotifyLink(group.playlist_url, "Open playlist in Spotify", "playlist-action"));
  return section;
}

async function renderPage() {
  const response = await fetch("prayers.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Prayer data is unavailable");
  const data = await response.json();
  if (!Array.isArray(data.groups)) throw new Error("Prayer data has no playlist groups");

  const [year, month, day] = data.date.split("-").map(Number);
  document.getElementById("today-date").textContent = dateFormatter.format(
    new Date(Date.UTC(year, month - 1, day, 12)),
  );

  if (data.wallpaper) {
    const image = document.getElementById("wallpaper");
    image.addEventListener("load", () => image.classList.add("is-ready"), { once: true });
    image.addEventListener("error", () => image.remove(), { once: true });
    image.src = data.wallpaper;
    image.hidden = false;
  }

  const nav = document.getElementById("group-nav");
  const groups = document.getElementById("playlist-groups");
  nav.replaceChildren();
  groups.replaceChildren();
  for (const group of data.groups) {
    const anchor = element("a", "group-tab", group.name);
    anchor.href = `#group-${group.key}`;
    nav.append(anchor);
    groups.append(renderGroup(group));
  }
}

renderPage().catch(() => {
  const groups = document.getElementById("playlist-groups");
  groups.replaceChildren(element("p", "error-message", "Today's prayer list could not be loaded. Please try again later."));
});
