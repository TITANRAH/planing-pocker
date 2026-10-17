// "N de M votaron" (RF-06): M son los participantes que están en la sala
export function VoteCounter({ voted, total }: { voted: number; total: number }) {
  return (
    <p role="status" aria-label="Votos" className="text-sm text-muted-foreground">
      {voted} de {total} votaron
    </p>
  );
}
