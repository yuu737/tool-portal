import { redirect } from "next/navigation";

// middleware が /ja or /en にリダイレクトするが、
// 万一スルーした場合のフォールバック
export default function RootPage() {
  redirect("/ja");
}
