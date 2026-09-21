import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { resourceHtml } from "./domain";
export async function printHtmlResource(title: string, html: string) {
  if (Platform.OS === "web") {
    await Print.printAsync({ html });
    return;
  }

  const file = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/pdf",
      dialogTitle: title,
    });
    return;
  }

  await Print.printAsync({ uri: file.uri });
}

export async function printResource(title: string, lines: string[]) {
  await printHtmlResource(title, resourceHtml(title, lines));
}
