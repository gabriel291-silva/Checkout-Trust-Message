import {
  reactExtension,
  Banner,
  BlockStack,
  Checkbox,
  Text,
  useApi,
  useApplyAttributeChange,
  useInstructions,
  useTranslate,
  useAppMetafields,
  useExtension,
} from "@shopify/ui-extensions-react/checkout";

// 1. Choose an extension target
export default reactExtension("purchase.checkout.block.render", () => (
  <Extension />
));

function Extension() {
  const translate = useTranslate();

  const extension = useApi();
  const instructions = useInstructions();
  const applyAttributeChange = useApplyAttributeChange();
  console.log({ extension })

  const metafields = useAppMetafields({
    namespace: "my_namespace",
    key: "config",
    type: "shop", // ou "cart", "customer", etc. — dependendo de onde o metafield foi salvo
  });

  const configRaw = metafields?.[0]?.value;

  let config: any = {};
  try {
    if (configRaw) {
      config = JSON.parse(configRaw);
    }
  } catch (error) {
    console.error("Erro ao interpretar o JSON do metafield:", error);
  }

  console.log({ metafields })

  // 2. Check instructions for feature availability, see https://shopify.dev/docs/api/checkout-ui-extensions/apis/cart-instructions for details
  if (!instructions.attributes.canUpdateAttributes) {
    // For checkouts such as draft order invoices, cart attributes may not be allowed
    // Consider rendering a fallback UI or nothing at all, if the feature is unavailable
    return (
      <Banner title="checkout-aplicativo-teste" status="warning">
        {translate("attributeChangesAreNotSupported")}
      </Banner>
    );
  }

  // 3. Render a UI
  return (
    <BlockStack border={"dotted"} padding={"tight"}>
      <Banner title="checkout-aplicativo-teste">
        teste
      </Banner>
      <Checkbox onChange={onCheckboxChange}>
        {translate("iWouldLikeAFreeGiftWithMyOrder")}
      </Checkbox>
    </BlockStack>
  );

  async function onCheckboxChange(isChecked) {
    // 4. Call the API to modify checkout
    const result = await applyAttributeChange({
      key: "requestedFreeGift",
      type: "updateAttribute",
      value: isChecked ? "yes" : "no",
    });
    console.log("applyAttributeChange result", result);
  }
}

