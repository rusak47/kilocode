import { afterEach, describe, expect, test as it } from "bun:test"
import { AppRuntime } from "../../src/effect/app-runtime"
import { Config } from "../../src/config/config"
import { Skill } from "../../src/skill"
import { disposeAllInstances, provideTestInstance, tmpdir } from "../fixture/fixture"
import fs from "fs/promises"
import path from "path"

afterEach(async () => {
  await disposeAllInstances()
})

describe("plugin skill trust", () => {
  it("loads plugin-injected skills from outside the project without scope errors", async () => {
    // The project is a git repo; the plugin cache (like ~/.cache/kilo/packages) lives OUTSIDE it.
    await using tmp = await tmpdir<string>({
      git: true,
      init: async (dir) => {
        const pluginDir = path.join(path.dirname(dir), `opencode-test-plugins-${path.basename(dir)}`)
        await fs.mkdir(path.join(pluginDir, "skills", "plugin-skill"), { recursive: true })
        await Bun.write(
          path.join(pluginDir, "skills", "plugin-skill", "SKILL.md"),
          `---
name: plugin-skill
description: A skill injected by a plugin from outside the project.
---

# Plugin Skill

This skill lives in a package cache directory outside the project root.
`,
        )
        return pluginDir
      },
      dispose: async (dir) => {
        await fs.rm(path.join(path.dirname(dir), `opencode-test-plugins-${path.basename(dir)}`), {
          recursive: true,
          force: true,
        })
        return dir
      },
    })

    await provideTestInstance({
      directory: tmp.path,
      fn: async () => {
        // Simulate a plugin config hook: push the plugin skills dir into the LIVE config
        // without a skill_path_origins entry (plugin hooks mutate cfg at runtime).
        const cfg = await AppRuntime.runPromise(Config.Service.use((svc) => svc.get()))
        cfg.skills = cfg.skills ?? {}
        cfg.skills.paths = cfg.skills.paths ?? []
        cfg.skills.paths.push(tmp.extra)

        const list = await AppRuntime.runPromise(Skill.Service.use((svc) => svc.all()))
        const pluginSkill = list.find((s) => s.name === "plugin-skill")
        expect(pluginSkill).toBeDefined()
        expect(pluginSkill!.description).toBe("A skill injected by a plugin from outside the project.")
        expect(pluginSkill!.location).toContain("plugin-skill/SKILL.md")
      },
    })
  })
})
