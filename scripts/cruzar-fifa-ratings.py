import pandas as pd
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORLD = ROOT / "data/world_cup_players_crosswalk.csv"
FIFA = ROOT / "data/fifa_player_data.csv"  # baixar a base FIFA 2005-2020
OUT = ROOT / "data/world_cup_players_crosswalk_fifa.csv"

def norm(s):
    s = "" if pd.isna(s) else str(s)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return " ".join(s.lower().replace("-", " ").split())

wc = pd.read_csv(WORLD)
fifa = pd.read_csv(FIFA)

# Compatível com a base lbenz730/fifa_model:
# name, year, rating, nationality, preferred_positions/country_position.
fifa["name_norm"] = fifa["name"].map(norm)
wc["nome_norm"] = wc["jogador"].map(norm)

# Copa de um ano -> edição FIFA seguinte (ex.: Copa 2014 -> FIFA 15).
fifa["edicao"] = pd.to_numeric(fifa["year"], errors="coerce")
fifa = fifa.rename(columns={"rating":"overall_fifa"})

# Primeiro tenta nome + edição; depois nome + nacionalidade não é usado
# automaticamente para evitar falsos positivos.
cols = ["name_norm","edicao","overall_fifa"]
fifa_small = fifa[cols].dropna(subset=["name_norm","edicao"]).drop_duplicates(
    ["name_norm","edicao"], keep="first"
)

m = wc.merge(
    fifa_small,
    left_on=["nome_norm","edicao_fifa_sugerida"],
    right_on=["name_norm","edicao"],
    how="left"
)

m["overall_final"] = m["overall_fifa"].combine_first(m["overall"])
m["overall_fonte_final"] = m["overall_fifa"].notna().map(
    {True:"FIFA_Index_2005_2020", False:"manual_existente_no_projeto"}
)
m["match_nome_edicao"] = m["overall_fifa"].notna()

m.drop(columns=["nome_norm","name_norm","edicao"], inplace=True, errors="ignore")
m.to_csv(OUT, index=False, encoding="utf-8-sig")

print("Gerado:", OUT)
print("Matches FIFA por nome+edição:", int(m["match_nome_edicao"].sum()))
print("Total jogadores:", len(m))
