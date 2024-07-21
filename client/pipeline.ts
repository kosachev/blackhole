export class Pipeline {
  private to_destruct: CallableFunction[] = [];

  constructor(private pipeline_id: number) {
    if (pipeline_id === 0 || !pipeline_id) return;
    console.debug("PIPELINE LOADED", pipeline_id);

    this.outdateTasks();
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
}
