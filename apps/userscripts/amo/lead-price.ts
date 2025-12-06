import { AMO } from "../../../src/amo/amo.constants";
import { CFV, leadDiscount, leadGoods, setLeadPrice } from "../common";

export class LeadPrice {
  readonly GOODS_LIST_SELECTOR = `div#${AMO.CATALOG.GOODS}.linked-form-holder.js-cf-group-wrapper.catalog_elements-in_card`;

  private readonly quantity_list_delay = 1000; // goods loaded lazely, so we shout wait

  private obervers: MutationObserver[] = [];

  constructor(private lead_id: number) {
    if (lead_id === 0 || !lead_id) return;
    console.debug("LEAD PRICE LOADED", lead_id);

    this.setupLinkedListObserver();
    CFV(AMO.CUSTOM_FIELD.DISCOUNT).on("change", () => this.check(lead_id));
  }

  destructor() {
    console.debug("LEAD PRICE DESTRUCTOR", this.lead_id);

    for (const observer of this.obervers) {
      observer.disconnect();
    }
    this.obervers = [];
    CFV(AMO.CUSTOM_FIELD.DISCOUNT).off("change");
    $('input[name="quantity"].catalog-fields__amount-field').off("change");
  }

  private async check(lead_id: number) {
    console.debug("CALCULATE LEAD PRICE");

    const goods = await leadGoods(lead_id);
    const total = goods.reduce((acc, cur) => acc + cur.quantity * cur.price, 0);
    const price = +$('input[name="lead[PRICE]"]').attr("value");
    const discount = leadDiscount(total);
    let total_with_discount = total - discount;
    if (total_with_discount < 0) total_with_discount = 0;
    if (total_with_discount !== price) {
      console.debug(
        `Price total (${total_with_discount}) and lead price (${price}) differs -> need update`,
      );
      const status = $("div#card_status_view_mode[data-status-id]").attr("data-status-id");
      const pipeline = $('input[name="lead[PIPELINE_ID]"]').attr("value");
      await setLeadPrice(lead_id, pipeline, status, total_with_discount);
    }
  }

  private setupGoodsListObserver() {
    const goods_list_observer = new MutationObserver((event) => {
      for (const [index, mutation] of event.entries()) {
        if (
          mutation.removedNodes.length > 0 &&
          mutation.target?.isEqualNode($(this.GOODS_LIST_SELECTOR).get(0)) &&
          !mutation.nextSibling?.isEqualNode(
            $("div.element_detail_wrapper.element_detail_wrapper-search.js-search_suggest").get(0),
          )
        ) {
          console.debug("REMOVED FROM LIST");
          setTimeout(() => {
            this.setupGoodsQuatityTrigger();
            this.check(this.lead_id);
          }, this.quantity_list_delay);
        }

        if (
          event.length === 3 &&
          index === 2 &&
          mutation.addedNodes.length > 0 &&
          mutation.addedNodes[0].previousSibling?.isEqualNode(
            $("div.element_detail_wrapper.element_detail_wrapper-search.js-search_suggest").get(0),
          ) &&
          mutation.target?.isEqualNode($(this.GOODS_LIST_SELECTOR).get(0))
        ) {
          console.debug("ADDED TO LIST");
          setTimeout(() => {
            this.setupGoodsQuatityTrigger();
            this.check(this.lead_id);
          }, this.quantity_list_delay);
        }
      }
    });

    goods_list_observer.observe($(`div#${AMO.CATALOG.GOODS}`).get(0), {
      childList: true,
      subtree: false,
      characterDataOldValue: true,
    });

    this.obervers.push(goods_list_observer);
  }

  private setupLinkedListObserver() {
    if ($(this.GOODS_LIST_SELECTOR).length > 0) {
      console.debug("GOODS LIST DETECTED");
      this.setupGoodsListObserver();
      setTimeout(() => this.setupGoodsQuatityTrigger(), this.quantity_list_delay);
    } else {
      console.debug("NO GOODS LIST, OBSERVE");

      const linked_lists_observer = new MutationObserver((event) => {
        if (
          event.length > 0 &&
          event[0].addedNodes.length > 0 &&
          (event[0].addedNodes[0] as HTMLElement).id === `${AMO.CATALOG.GOODS}`
        ) {
          console.debug("GOODS LIST DETECTED");
          linked_lists_observer.disconnect();
          this.setupGoodsListObserver();
          setTimeout(() => this.setupGoodsQuatityTrigger(), this.quantity_list_delay);
        }
      });

      linked_lists_observer.observe(
        $("div.card-fields__linked-block.js-linked_elements_wrapper").get(0),
        {
          childList: true,
          subtree: false,
        },
      );

      this.obervers.push(linked_lists_observer);
    }
  }

  private setupQuantityObserver() {
    const quantity_observer = new MutationObserver((event) => {
      for (const mutation of event) {
        if (
          mutation.target?.nodeName === "TESTER" &&
          mutation.addedNodes.length > 0 &&
          mutation.addedNodes[0]?.nodeName === "#text" &&
          (mutation.target as HTMLElement).offsetParent?.className ===
            "catalog-fields__container-item catalog-fields__container-item--amount "
        )
          console.log("QUANTITY CHANGED", mutation.target);
      }
    });

    quantity_observer.observe($(`div#${AMO.CATALOG.GOODS}`).get(0), {
      childList: true,
      subtree: true,
    });

    this.obervers.push(quantity_observer);
  }

  private setupGoodsQuatityTrigger() {
    const el = $('input[name="quantity"].catalog-fields__amount-field');
    console.debug("SETUP GOODS QUANTITY TRIGGER", el.length);
    el.off("change");
    el.on("change", (e) => {
      // @ts-expect-error isTrigger should be 3 on target event
      if (e.isTrigger === 3) {
        console.debug("QUANTITY CHANGED");
        this.check(this.lead_id);
      }
    });
  }
}
