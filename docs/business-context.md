# Rice mill business context

These notes preserve business information from the retired `SYSTEM_DESIGN.md`, whose business decisions were dated April 2026. They describe the mill and questions for the owner, **not** implemented app modules or confirmed current operating terms. Recheck them with the family before using them as accounting rules or customer-facing claims.

## Workflows described in the earlier design

- Government custom milling: receive an APSCSCL paddy lot, mill it, deliver milled rice to assigned godowns, and retain broken rice, husk, and bran as by-products.
- By-product sales: sell broken rice, rice husk, and rice bran to private buyers. Paddy varieties and government rice output are not by-products for sale.
- Private paddy procurement was a planned growth area. The old document conflicted on whether procurement had started; confirm its current status before building a workflow around it.
- The family tracked operating data in Excel. The present dashboard analyzes those workbooks in the browser; canonical server-side import remains planned.

## Terms

| Term | Meaning in the earlier design |
| --- | --- |
| Quintal (qtl) | 100 kg |
| Milling run | One paddy-processing batch producing rice and by-products |
| Godown / drop point | Destination for a government rice delivery |
| Challan | Dispatch document for a delivery |
| Yield | Milled rice output divided by paddy input, expressed as a percentage |
| Kharif / Rabi | The two seasons mentioned for government work |

The old design recorded six possible APSCSCL charges per quintal: milling, sortex, paddy transport, rice transport, blending, and gunny usage. It also mentioned a bank guarantee and variable godown assignments. These are historical business notes; rates and terms must be verified from current documents before any calculation is implemented.

## Questions to confirm before building operational modules

- What is the current APSCSCL lot reference format, and who assigns godowns?
- Which charges apply in the current season, at what rates, and when are they paid?
- Is private paddy procurement operating now, and how is it recorded?
- Does the mill need app-generated challans or only a record of existing documents?
- Which licences and guarantees are current? The old design listed a count but no authoritative list.

The active product and implementation roadmap are described in [the project README](../README.md), [the v2 task handoff](../tasks/rice-mill-v2.md), and the unchanged [implementation spec](../specs/ai-backend-and-dashboard.md).
