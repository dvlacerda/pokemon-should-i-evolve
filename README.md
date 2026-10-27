# Should I evolve it?

A small static website that answers one question for a chosen Pokémon: **should I evolve it?**
Built for the Pokémon case in *AI in Accounting and Business* (SDU).

**How it decides**

1. You pick a Pokémon (search by name or number, or *Surprise me*).
2. The site finds every species it can evolve into (`evolves_from_species_id` in the data) and shows
   both side by side with their sprites, types, stats, abilities and size.
3. You say how you'll use it: all-rounder, physical attacker, special attacker, tank or fast striker.
   Each profile weights the six base stats differently; the recommendation compares the weighted
   totals before and after:
   - +15% or more: **Evolve it**
   - +3% to +15%: **Evolve, small upgrade**
   - −3% to +3%: **It's a toss-up**
   - below −3%: **Keep it as it is**
4. Optional deal-breakers (keep its type, keep all its abilities, stay small) override the stats.
5. When there are several evolutions (e.g. Eevee), they are ranked by fit to your profile.

38 evolutions in the data lose at least one stat (e.g. Scyther → Scizor loses 40 Speed), so the answer
genuinely changes with your priorities. The dataset has no move lists or evolution methods, so the
advice covers stats, types, abilities and size only.

**Data and images**

- `data/pokemon.csv` is the course dataset (811 rows). `tools/build_data.py` converts it to
  `data/pokemon.json` and adds each species' list of possible evolutions.
- Sprites are loaded from the public [PokeAPI sprites repository](https://github.com/PokeAPI/sprites)
  using each row's `url_image`; 93 alternate forms have no image in the data and show a placeholder.

**Run locally**

```bash
python tools/build_data.py data/pokemon.csv data/pokemon.json   # only if the CSV changes
python -m http.server 8000                                        # then open http://localhost:8000
```

**Publish with GitHub Pages**: push to a public repository, then *Settings → Pages → Deploy from a
branch → main / (root)*.

Pokémon and its characters are trademarks of Nintendo, Creatures Inc. and GAME FREAK. This is an
unofficial, non-commercial student project.
