"""Convert pokemon.csv into the compact JSON the website loads.

Usage: python tools/build_data.py data/pokemon.csv data/pokemon.json
Adds, for every species, the list of species it can evolve into.
"""
import json
import math
import sys

import pandas as pd

STATS = ["hp", "attack", "defense", "special_attack", "special_defense", "speed"]


def clean(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


def main(src, dst):
    df = pd.read_csv(src)
    base = df[df.id == df.species_id]
    children = base.dropna(subset=["evolves_from_species_id"]).groupby(
        base.dropna(subset=["evolves_from_species_id"]).evolves_from_species_id.astype(int)
    ).species_id.apply(lambda s: sorted(int(x) for x in s)).to_dict()

    out = []
    for r in df.itertuples(index=False):
        is_form = r.id != r.species_id
        out.append({
            "id": int(r.id),
            "name": r.pokemon,
            "species": int(r.species_id),
            "form": bool(is_form),
            "img": clean(r.url_image),
            "types": [t for t in (clean(r.type_1), clean(r.type_2)) if t],
            "colors": [c for c in (clean(r.color_1), clean(r.color_2)) if c],
            "stats": {s: int(getattr(r, s)) for s in STATS},
            "abilities": [a for a in (clean(r.ability_1), clean(r.ability_2)) if a],
            "hidden": clean(r.ability_hidden),
            "base_experience": int(r.base_experience),
            "height": int(r.height),      # decimetres
            "weight": int(r.weight),      # hectograms
            "gen": clean(r.generation_id),
            "from": None if is_form else clean(r.evolves_from_species_id),
            "to": [] if is_form else children.get(int(r.species_id), []),
            "chain": clean(r.evolution_chain_id),
        })
    with open(dst, "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"))
    print(f"{len(out)} entries -> {dst}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
