import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'

const PISTI_SECTIONS: { title: string; items: string[] }[] = [
  {
    title: 'Dağıtım',
    items: [
      '52 kart, joker yok. Herkese 4 kart; masaya 1 açık + 3 kapalı konur.',
      'Oyun dağıtıcının sağından başlar. Karşılıklı oturanlar takımdır.',
      'Açık kartı ilk toplayan takım, alttaki 3 kapalı kartı bir kez görür.',
    ],
  },
  {
    title: 'Normal oyun',
    items: [
      'Sırayla elinden bir kart atarsın. Üstteki kartla aynı değerdeyse veya Vale (J) ise yeri alırsın.',
      'Yerde tek kart varken eşleşme veya Vale Pişti’dir: 10 puan, yer 5 ise 50 puan.',
      'Eller bitince 4’er kart daha dağıtılır. Deste bitince yerde kalan son toplayana gider.',
    ],
  },
  {
    title: 'Kapalı kart ve blöf',
    items: [
      'Yerde tam 1 kart varken kapalı atmak otomatik Pişti iddiasıdır.',
      'Sıradaki rakip İnan veya Blöf de diyebilir.',
      'İnanılırsa kart açılmaz; iddia eden takım 10 (yer 5 ise 50) alır.',
      'Blöf denir ve sahteyse yakalayan takım 10 alır, kart açık yerde kalır.',
      'Gerçek Piştiye blöf denirse iddia eden 20 (yer 5 ise 100) alır.',
    ],
  },
  {
    title: 'Puanlar ve bitiş',
    items: [
      'Sinek 2: 2, Karo 10: 3, her As ve Vale: 1. En çok kart: 3 (eşitlikte 0).',
      'Pişti puanları el sonunda kart puanlarıyla toplanır.',
      'Toplam 205 puana ulaşan takım kazanır.',
    ],
  },
]

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: 'Oyunun amacı',
    items: [
      'Taşlarını seri (aynı renk, ardışık sayı) ve küt (aynı sayı, farklı renk) perlerine dizip elini bitirmek.',
      'Puanı en düşük olan kazanır. Biten oyuncu -101 yazar.',
      'Başlayan oyuncu 22, diğerleri 21 taş alır. Sıra sağa doğru ilerler.',
    ],
  },
  {
    title: 'Okey ve gösterge',
    items: [
      'Ortadaki gösterge taşının bir üstü okeydir (13 ise 1). Okey ★ ile işaretlenir ve her taşın yerine geçer.',
      'Sahte okey, okeyin yerine geçen gerçek taştır: okey hangi renk ve sayıysa sahte okey de odur.',
      'Seride 12-13-1 geçerlidir, 13-1-2 geçerli değildir.',
    ],
  },
  {
    title: '101 ile açılış (Seri)',
    items: [
      'Elini açmak için seçtiğin perlerin toplamı en az 101 olmalı.',
      'Açtıktan sonra yeni perler açabilir ve masadaki perlere taş işleyebilirsin.',
    ],
  },
  {
    title: '5 çift ile açılış (Çift)',
    items: [
      'Birbirinin aynısı 5 çift ile de açabilirsin. Okey her taşla çift olur.',
      'Çift açan oyuncu sonrasında yalnızca çift açabilir ama perlere taş işleyebilir.',
      'Çift açanın elinde kalan taşların cezası iki katıdır.',
    ],
  },
  {
    title: 'Taş alma ve işleme',
    items: [
      'Sıran gelince desteden taş çekersin ya da önceki oyuncunun attığı taşı alırsın.',
      'Yerden aldığın taşı aynı el kullanmalısın (açarak ya da işleyerek). Kullanamazsan geri bırakırsın ve +101 ceza yazılır.',
      'Bir pere okeyin tuttuğu gerçek taşı işlersen okey eline geçer; sonra bir taş atman gerekir.',
      '1 yalnızca 1-2-3 tarafına işlenir. 13’ün yanına 1 işlenemez (12-13-1 sadece per olarak açılır).',
    ],
  },
  {
    title: 'Cezalar',
    items: [
      'Masadaki bir pere işlenebilecek taşı atmak: +101.',
      'Okey atmak: +101 (bitiş taşı hariç).',
      'Elini açmadan el biterse: +202.',
      'Açtıysan elinde kalan taşların toplamı yazılır (elde kalan okey 101 sayılır).',
    ],
  },
  {
    title: 'Bitiş puanları',
    items: [
      'Normal bitiş: biten -101, diğerlerinin cezası normal.',
      'Okey atarak bitiş: tüm puanlar x2.',
      'Çiftten bitiş: tüm puanlar x2.',
      'Elden bitiş (aynı turda açıp bitirmek): tüm puanlar x4.',
      'Çarpanlar birlikte uygulanır. Deste biterse kimse bitmemiş sayılır.',
    ],
  },
  {
    title: 'Eşli oyun',
    items: [
      'Karşılıklı oturan oyuncular takımdır (1.-3. ve 2.-4. koltuk).',
      'Takımın puanı iki oyuncunun toplamıdır. Eşin biterse senin el cezan yazılmaz.',
    ],
  },
]

export function RulesModal({
  open,
  onClose,
  variant = 'okey',
}: {
  open: boolean
  onClose: () => void
  variant?: 'okey' | 'pisti'
}) {
  const sections = variant === 'pisti' ? PISTI_SECTIONS : SECTIONS
  return (
    <Modal open={open} onClose={onClose} title="Oyun kuralları" size="lg">
      <div className="flex flex-col gap-5">
        {sections.map((s) => (
          <section key={s.title}>
            <h3 className="mb-1.5 text-sm font-extrabold tracking-wider text-accent-strong uppercase">{s.title}</h3>
            <ul className="flex flex-col gap-1 text-[15px] leading-relaxed text-ivory-200">
              {s.items.map((it) => (
                <li key={it} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ivory-400" aria-hidden />
                  {it}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  )
}

export function RulesButton({
  className = '',
  showLabel = false,
  variant = 'okey',
}: {
  className?: string
  showLabel?: boolean
  variant?: 'okey' | 'pisti'
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-full bg-white/8 px-3 text-xs font-bold tracking-wider text-ivory-200 ring-1 ring-white/10 transition hover:bg-white/14 hover:text-ivory-50 ${className}`}
        aria-label="Oyun kuralları"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ivory-100 text-[11px] font-black text-felt-900" aria-hidden>
          ?
        </span>
        <span className={showLabel ? '' : 'hidden sm:inline'}>OYUN KURALLARI</span>
      </button>
      <RulesModal open={open} onClose={() => setOpen(false)} variant={variant} />
    </>
  )
}
