// IMPORTAÇÕES NECESSÁRIAS
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import {
  BlockStack,
  Layout,
  Page,
  Text,
  Button,
  TextField,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { json } from "@remix-run/node";

// ... (imports e interfaces iguais ao anterior)
interface LoaderData {
  shopDomain: string;
  config: {
    texto: string;
    disabled?: boolean;
  };
}
const defaultConfig: any = {
  texto: "",
  disabled: true,
};

// LOADER: carrega a configuração existente
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  let config = defaultConfig;

  const metafieldQuery = `
    query getTimerConfig($namespace: String!, $key: String!) {
      shop {
        id
        metafield(namespace: $namespace, key: $key) {
          value
        }
      }
    }
  `;

  const metafieldResp = await admin.graphql(metafieldQuery, {
    variables: { namespace: "my_namespace", key: "config" },
  });

  const metafieldResult = await metafieldResp.json();
  const savedValue = metafieldResult.data?.shop?.metafield?.value;
  const shopId = metafieldResult.data?.shop?.id;

  if (savedValue) {
    try {
      config = JSON.parse(savedValue);
    } catch {
      config = defaultConfig;
    }
  } else {
    // Cria o metafield se não existir
    await admin.graphql(`
      mutation metafieldSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        metafields: [{
          ownerId: shopId,
          namespace: "my_namespace",
          key: "config",
          value: JSON.stringify(defaultConfig),
          type: "json",
        }]
      }
    });
  }

  return json({
    shopDomain: session.shop,
    config,
  });
};

// ACTION: trata mudanças de estado e de texto
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");
  const newText = formData.get("newText");

  const shopQuery = `query { shop { id } }`;
  const shopResp = await admin.graphql(shopQuery);
  const shopData = await shopResp.json();
  const shopId = shopData.data?.shop?.id;

  if (!shopId) throw new Error("Não foi possível obter o ID da loja");

  const updateMetafield = async (newConfig: any) => {
    const mutation = `
      mutation metafieldSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors { field message }
        }
      }
    `;

    const result = await admin.graphql(mutation, {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: "my_namespace",
            key: "config",
            value: JSON.stringify(newConfig),
            type: "json",
          },
        ],
      },
    });

    const jsonResult = await result.json();
    if (jsonResult.data?.metafieldsSet?.userErrors?.length > 0) {
      console.error("Erros ao salvar metafield:", jsonResult.data.metafieldsSet.userErrors);
    }
  };

  // Busca o config atual
  const mfResp = await admin.graphql(`
    query {
      shop {
        metafield(namespace: "my_namespace", key: "config") {
          value
        }
      }
    }
  `);
  const mfData = await mfResp.json();

  let newConfig = defaultConfig;
  if (mfData.data?.shop?.metafield?.value) {
    try {
      newConfig = JSON.parse(mfData.data.shop.metafield.value);
    } catch {
      newConfig = { ...defaultConfig };
    }
  }

  if (actionType === "deactivate") {
    newConfig.disabled = true;
    await updateMetafield(newConfig);
    return json({ success: true, action: "deactivated" });
  }

  if (actionType === "activate") {
    newConfig.disabled = false;
    await updateMetafield(newConfig);
    return json({ success: true, action: "activated" });
  }

  if (actionType === "updateText" && typeof newText === "string") {
    newConfig.texto = newText;
    await updateMetafield(newConfig);
    return json({ success: true, action: "textUpdated" });
  }

  return json({ success: false });
};

// COMPONENTE DE INTERFACE
export default function Index() {
  const fetcher = useFetcher();
  const { config } = useLoaderData<LoaderData>();

  const [texto, setTexto] = useState(config.texto || "");

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.action === "activated") {
        shopify.toast.show("Timer ativado com sucesso!");
      } else if (fetcher.data.action === "deactivated") {
        shopify.toast.show("Timer desativado.");
      } else if (fetcher.data.action === "textUpdated") {
        shopify.toast.show("Texto atualizado com sucesso!");
      }
    }
  }, [fetcher.data]);

  return (
    <Page>
      <TitleBar title="Remix app template" />

      <Layout>
        <Layout.Section>
          <BlockStack gap="200">
            <Text as="h1" variant="headingLg">
              Olá! Bem-vindo ao aplicativo de teste
            </Text>
            <Text variant="bodyMd" tone="subdued">
              Abaixo você pode ativar/desativar o timer e editar a configuração de texto.
            </Text>

            {/* FORMULÁRIO PARA ALTERAR TEXTO */}
            <fetcher.Form method="post">
              <input type="hidden" name="actionType" value="updateText" />
              <TextField
                label="Texto de configuração"
                name="newText"
                value={texto}
                onChange={setTexto}
                autoComplete="off"
              />
              <Button submit primary>Salvar Texto</Button>
            </fetcher.Form>

            {/* BOTÕES DE AÇÃO */}
            <fetcher.Form method="post">
              <input type="hidden" name="actionType" value="activate" />
              <Button submit>Ativar Timer</Button>
            </fetcher.Form>

            <fetcher.Form method="post">
              <input type="hidden" name="actionType" value="deactivate" />
              <Button submit tone="critical">Desativar Timer</Button>
            </fetcher.Form>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
