export abstract class Plugin {
  constructor(protected lead_id: number) {}

  abstract destructor(): void;

  style(): string {
    return "";
  }


  protected addTopListButton(params: { id: string; icon: string; text: string; onClick: () => void }) {
    const toplist = $("div.card-fields__top-name-more").find("ul");
    if ($(toplist).find(`li div#${params.id}`).length === 0) {
      $(toplist).append(/*html*/ `
        <li class="button-input__context-menu__item  element__ ">
          <div id="${params.id}" class="button-input__context-menu__item__inner">
            <span class="button-input__context-menu__item__icon-container">${params.icon}</span>
            <span class="button-input__context-menu__item__text "> ${params.text}</span>
          </div>
        </li>`);

      $(`#${params.id}`).on("click", params.onClick);
    }
  }
}
