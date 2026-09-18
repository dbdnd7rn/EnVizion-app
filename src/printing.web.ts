import { resourceHtml } from "./domain";
/** Open the worksheet itself, rather than printing the app navigation. */
export async function printResource(title: string, lines: string[]) {
  const preview = window.open("", "_blank", "width=820,height=900");
  if (!preview) throw new Error("The browser blocked the print window.");
  preview.opener = null;
  preview.document.open();
  preview.document.write(resourceHtml(title, lines));
  preview.document.close();
  preview.focus();
  preview.print();
}
