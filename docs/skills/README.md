# Skills embebidas

Copia espejo de las skills de Hermes relevantes para este proyecto. Se mantiene aquí para que:

1. **Versionado junto al código** — cualquier cambio en la skill se refleja en git, con commit message descriptivo.
2. **Onboarding** — alguien que clone el repo entiende el flujo operativo sin pedir contexto externo.
3. **Dokploy** — si en el futuro se quiere ejecutar el agente desde un contenedor, tiene todo lo necesario en el propio repo.

## Skills

- **`value-investing-simulation/`** — Marco completo de gestión de cartera value simulada. Define el flujo de análisis (macro → screening → 6 bloques → scoring 0-100 → formato pre-operación → ejecución vía API), reglas de construcción (máx 8% por empresa, 25% sector, 12-25 posiciones), control de sesgos y reglas de compra/venta.

## Sincronización

La fuente de verdad es la skill instalada en Hermes (`~/AppData/Local/hermes/skills/research/value-investing-simulation/`). Esta carpeta es un snapshot que se actualiza manualmente cuando hay cambios significativos en el marco operativo.

```bash
# Actualizar la copia del repo
cp ~/AppData/Local/hermes/skills/research/value-investing-simulation/SKILL.md docs/skills/value-investing-simulation/SKILL.md
git add docs/skills/
git commit -m "chore(skills): sync value-investing-simulation to repo"
git push
```

El push a `master` dispara el auto-deploy de Dokploy.
