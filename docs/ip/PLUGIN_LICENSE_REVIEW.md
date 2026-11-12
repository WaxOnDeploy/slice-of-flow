# Standalone editor-plugin removal and historical findings

**Updated November 12, 2026.** The two editor-only development plugins have been removed from this standalone GitHub/Vercel repository's current package manifest, pinned dependency graph and Vite configuration. Their publisher-license questions are not being recast as resolved permissions. Jeff Bourke's proprietary project license does not relicense third-party software.

## What changed

`@builder.io/vite-plugin-jsx-loc@0.1.1` and `vite-plugin-manus-runtime@0.0.57` were used for development-serving instrumentation, not the production application. The current standalone configuration uses the existing React and Tailwind plugins without those editor imports. The dependency declarations and lockfile entries were removed using the pinned package manager; no third-party package was copied into source or given a new license.

This is a forward-looking dependency cleanup. The separate original Manus-managed project retains its configuration and editor instrumentation. Its package/configuration files were not changed. Previous commits and the actual historical findings below are retained; removal does not revoke valid earlier permissions or retroactively settle a redistribution question.

## Historical Builder plugin finding

The exact-version registry metadata for `@builder.io/vite-plugin-jsx-loc@0.1.1` has no license field, but its publisher README declares **MIT**. The downloaded publisher archive matched registry integrity and the previously installed package files. A version-applicable standalone LICENSE and complete copyright notice were not located. This is **a publisher declaration with incomplete notice evidence**, not a declaration that Slice of Flow is an open-source project. Do not substitute an unrelated current Builder repository license. [1] [2]

## Historical Manus runtime finding

The exact-version `vite-plugin-manus-runtime@0.0.57` metadata has no license/repository field, and its archive contains no README or LICENSE. A public version-applicable distribution grant was not located. Public package availability does not prove a redistribution license, and missing metadata does not prove that all use was prohibited. The historical permission question remains unresolved. [3] [4]

Provider terms for generated outputs do not grant ownership of the provider's service/plugin software. If either plugin is reintroduced, obtain the applicable documented permissions and notices for that intended use before treating redistribution as cleared. [5]

## Validation and scope

The cleanup is checked with pinned/frozen dependency installation, the full regression suite, TypeScript, fresh root and Pages builds, a standalone development-server check and browser gameplay/export/license regressions. Runtime source, gameplay rules, artwork, author credit, the public proprietary LICENSE and Vercel security policy are unchanged. Build success is not a legal clearance certificate; the actual evidence and tested revision are recorded in the pull request.

Remaining application dependencies retain their own licenses and notices. Their rights are not replaced by Jeff's proprietary project license. No full supply-chain or legal-compliance certification is claimed.

## References

[1]: https://registry.npmjs.org/@builder.io%2fvite-plugin-jsx-loc/0.1.1 "Builder Plugin Exact-Version Registry Metadata"
[2]: https://registry.npmjs.org/@builder.io/vite-plugin-jsx-loc/-/vite-plugin-jsx-loc-0.1.1.tgz "Builder Plugin Exact-Version Publisher Archive"
[3]: https://registry.npmjs.org/vite-plugin-manus-runtime/0.0.57 "Manus Runtime Exact-Version Registry Metadata"
[4]: https://registry.npmjs.org/vite-plugin-manus-runtime/-/vite-plugin-manus-runtime-0.0.57.tgz "Manus Runtime Exact-Version Publisher Archive"
[5]: https://manus.im/terms "Manus Terms Distinguishing User Output from Services Rights"
