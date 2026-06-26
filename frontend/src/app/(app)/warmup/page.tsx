"use client";

import { ComingSoon } from "@/components/coming-soon";

export default function WarmupPage() {
  return (
    <ComingSoon
      title="Rozgrzewanie"
      subtitle="Buduj reputację skrzynek przed wysyłką na zimno"
      note="Zaplanowane — start przez integrację z gotowym rozgrzewaczem, nie własną siecią."
      features={[
        {
          title: "Status rozgrzewania",
          desc: "Per skrzynka: czy jest rozgrzewana, od ilu dni, aktualny poziom reputacji.",
        },
        {
          title: "Ramp wysyłek",
          desc: "Stopniowe zwiększanie dziennego wolumenu wg harmonogramu, by nie spalić skrzynki.",
        },
        {
          title: "Integracja z rozgrzewaczem",
          desc: "Podpięcie zewnętrznego serwisu (np. Mailreach / Instantly) zamiast budowy sieci peer-to-peer od zera.",
        },
        {
          title: "Auto-pauza wysyłki",
          desc: "Wstrzymanie kampanii z danej skrzynki, gdy reputacja spadnie poniżej progu.",
        },
      ]}
    />
  );
}
