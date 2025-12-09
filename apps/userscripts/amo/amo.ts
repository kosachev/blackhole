import { GarbageCollector } from "./garbage-collector";
import { Lead } from "./lead";
import { Pipeline } from "./pipeline";

console.warn("TEMPER MONKEY SCRIPT LOADED");

(($: JQueryStatic) => {
  function onDomChange(target: Node, callback: MutationCallback) {
    new MutationObserver(callback).observe(target, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  }

  const gc = new GarbageCollector();
  let lastLoc = "";

  onDomChange(document.body, () => {
    const parts = location.href.split("?")[0].split("/");
    const currentLoc = parts[4] + "/" + parts[5];

    if (currentLoc !== lastLoc) {
      lastLoc = currentLoc;
      gc.clean();

      switch (parts[4]) {
        case "pipeline":
          window.setTimeout(() => gc.push(new Pipeline(+parts[5])), 1000);
          break;
        case "detail":
          window.setTimeout(() => gc.push(new Lead(+parts[5])), 2000);
          break;
      }
    }
  });

  $('div.nav__menu__item[data-entity="leads"] > a').on("click", () => {
    const parts = location.href.split("?")[0].split("/");
    if (parts[4] === "pipeline") {
      gc.clean();
      window.setTimeout(() => gc.push(new Pipeline(+parts[5])), 1000);
    }
  });

  $("div.n-avatar__overlay > svg, div.n-avatar__overlay > span").css(
    "filter",
    "sepia(1) hue-rotate(45deg) saturate(5)",
  );
})(window["jQuery"].noConflict(true));
