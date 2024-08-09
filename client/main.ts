import { GarbageCollector } from "./garbage-collector";
import { Lead } from "./lead";
import { Pipeline } from "./pipeline";

console.warn("TEMPER MONKEY SCRIPT LOADED");

(($: JQueryStatic) => {
  let lastloc = "";
  const gc = new GarbageCollector();
  $.fn.change = function (cb) {
    $(this).each(function () {
      function callback(changes) {
        cb.call(node, changes, this);
      }
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const node = this;
      new MutationObserver(callback).observe(node, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    });
    return $(this);
  };

  $("body").change(() => {
    const loc = location.href.split("?")[0].split("/");
    if (loc[4] + "/" + loc[5] != lastloc) {
      console.debug("LOCATION CHANGED", loc[4] + "/" + loc[5]);
      lastloc = loc[4] + "/" + loc[5];
      gc.clean();
      switch (loc[4]) {
        case "pipeline":
          setTimeout(() => gc.push(new Pipeline(+loc[5])), 1000);
          break;
        case "detail":
          setTimeout(() => gc.push(new Lead(+loc[5])), 2000);
          break;
      }
    }
  });

  $('div.nav__menu__item[data-entity="leads"] > a').on("click", () => {
    const loc = location.href.split("?")[0].split("/");
    console.debug("LEADS CLICKED");
    if (loc[4] === "pipeline") {
      gc.clean();
      setTimeout(() => gc.push(new Pipeline(+loc[5])), 1000);
    }
  });

  $("div.n-avatar__overlay > svg").css("filter", "sepia(1) hue-rotate(45deg) saturate(5)");
  $("div.n-avatar__overlay > span").css("filter", "sepia(1) hue-rotate(45deg) saturate(5)");
})(window["jQuery"].noConflict(true));
