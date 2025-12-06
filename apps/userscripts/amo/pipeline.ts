export class Pipeline {
  private to_destruct: CallableFunction[] = [];

  constructor(private pipeline_id: number) {
    if (pipeline_id === 0 || !pipeline_id) return;
    console.debug("PIPELINE LOADED", pipeline_id);

    this.outdateTasks();
    this.cdekPickupInformer();
  }

  destructor() {
    console.debug("PIPELINE DESTRUCTOR", this.pipeline_id);
    for (const fn of this.to_destruct) {
      fn();
    }
  }

  private outdateTasks() {
    $("div.pipeline_leads__item").each((i, el) => {
      if ($(el).find("span.pipeline_leads__task-icon.pipeline_leads__task-icon_red").length > 0) {
        $(el).css({ background: "#fedbdb", border: "2px solid rgba(255,50,50,.2)" });
      }
    });
  }

  private cdekPickupInformer() {
    let pickups = JSON.parse(localStorage.getItem("cdek_pickups") ?? "[]");
    pickups = pickups.filter((item: any) => item.datetime > Date.now());
    localStorage.setItem("cdek_pickups", JSON.stringify(pickups));
    const target = $(`div#status_id_12470895 > div.pipeline_status__head_title`);
    if (target.find("span.pickup_informer").length > 0) {
      target.find("span.pickup_informer").remove();
    }
    if (pickups.length === 0) {
      target.attr("title", "СДЭК");
      return;
    }
    target.attr("title", `Ближайшая дата забора: ${pickups[0].date} ${pickups[0].time}`);
    target.append(`<span class="pickup_informer">🚚</span>`);
  }
}
