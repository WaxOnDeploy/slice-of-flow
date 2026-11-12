# Development-plugin licensing status

**Reviewed November 12, 2026. These findings do not certify complete license compliance or ownership.** Neither plugin is relicensed by the proposed Jeff Bourke notice.

## Builder plugin 0.1.1

`@builder.io/vite-plugin-jsx-loc@0.1.1` has no registry license field, but the publisher's exact-version README declares **MIT**. The downloaded publisher archive matched registry integrity and the installed package files. There is no bundled standalone LICENSE or full copyright notice. An authoritative upstream commit/tag and version-applicable full notice were not located. [1] [2]

Record this as **MIT declared; complete notice evidence unresolved**, not simply unlicensed. Do not substitute a current Builder repository license that has not been mapped to this plugin version. Retain the actual published declaration and obtain/preserve a version-applicable notice where required before claiming redistribution clearance.

## Manus runtime 0.0.57

`vite-plugin-manus-runtime@0.0.57` has no registry license or repository field, and its publisher archive contains no README or LICENSE. No authoritative version-applicable package license or public upstream mapping was located. This remains **unresolved**; public package availability is not proof of a general distribution grant, and absence of metadata is not proof that use is prohibited. [3] [4]

Manus's generated-output ownership provisions do not grant ownership of, or a redistribution license for, its service/plugin software. Obtain documented permission for the version and intended use, or separately evaluate approved removal/replacement in a dedicated deployment clone. Do not silently remove instrumentation from a Manus-managed project. [5]

## Production configuration

The inspected `vite.config.ts` adds both plugins only when Vite's command is `serve`. Their own implementations do not independently enforce that restriction. Top-level imports and development dependency declarations remain. Existing artifact searches showed no targeted runtime/plugin markers, but were not fresh-build or live-deployment verification.

This draft PR does not change the plugins, their versions or activation. A future removal/replacement needs its own frozen-lockfile installation, fresh root/Pages builds, development-server verification and gameplay/export/route regressions. Archive the actual evidence and tested revision; do not mark permissions resolved merely because a build passed.

## References

[1]: https://registry.npmjs.org/@builder.io%2fvite-plugin-jsx-loc/0.1.1 "Builder Plugin Exact-Version Registry Metadata"
[2]: https://registry.npmjs.org/@builder.io/vite-plugin-jsx-loc/-/vite-plugin-jsx-loc-0.1.1.tgz "Builder Plugin Exact-Version Publisher Archive"
[3]: https://registry.npmjs.org/vite-plugin-manus-runtime/0.0.57 "Manus Runtime Exact-Version Registry Metadata"
[4]: https://registry.npmjs.org/vite-plugin-manus-runtime/-/vite-plugin-manus-runtime-0.0.57.tgz "Manus Runtime Exact-Version Publisher Archive"
[5]: https://manus.im/terms "Manus Terms Distinguishing User Output from Services Rights"
