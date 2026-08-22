# Cruzamento de jogadores da Copa x ratings

`world_cup_players_crosswalk.csv` contém os 12.221 registros de jogadores das
Copas presentes no projeto, cruzados pelo `sourcePlayerId` com os 905 overalls
manuais já existentes.

A coluna `status_cruzamento_fifa` permanece como pendente até a importação da
base histórica FIFA. O script `scripts/cruzar-fifa-ratings.py` faz o cruzamento
por nome + edição FIFA quando `data/fifa_player_data.csv` estiver disponível.

Regra de edição: Copa de 2014 -> FIFA 15; Copa de 2018 -> FIFA 19; Copa de 2022
-> FIFA 23; Copa de 2026 -> FC26.
