<script setup lang="ts">
import type { AdminPresentation } from '../../data/admin-config'
withDefaults(defineProps<{ motif?: AdminPresentation['motif']; compact?: boolean }>(), { motif: 'spark', compact: false })
</script>
<template>
  <svg class="admin-motif" :class="{ compact }" :data-motif="motif" viewBox="0 0 240 200" aria-hidden="true" focusable="false">
    <ellipse class="shadow" cx="124" cy="178" rx="80" ry="12" />
    <g v-if="motif === 'bloom'">
      <path class="stem" d="M122 164Q101 122 122 77M115 145Q76 144 66 114Q101 108 115 145M120 129Q149 102 174 112Q167 143 120 145" />
      <g class="primary"><ellipse cx="121" cy="56" rx="22" ry="30"/><ellipse cx="91" cy="76" rx="30" ry="22" transform="rotate(30 91 76)"/><ellipse cx="104" cy="106" rx="22" ry="29"/><ellipse cx="143" cy="102" rx="23" ry="29"/><ellipse cx="152" cy="70" rx="29" ry="22"/></g>
      <circle class="accent" cx="122" cy="81" r="24"/><path class="face" d="M112 83Q122 93 132 83"/><circle class="ink" cx="113" cy="74" r="2.5"/><circle class="ink" cx="131" cy="74" r="2.5"/>
      <path class="shine" d="M119 35Q128 33 131 45"/><circle class="secondary" cx="47" cy="67" r="10"/><path class="accent" d="m185 44 5 11 12 4-12 5-5 11-4-11-12-5 12-4Z"/>
    </g>
    <g v-else-if="motif === 'orbit'">
      <circle class="primary" cx="120" cy="101" r="57"/><path class="secondary" d="M71 77Q112 38 168 77Q142 67 119 92Q94 117 64 108Z"/>
      <ellipse class="orbit" cx="120" cy="106" rx="97" ry="25" transform="rotate(-24 120 106)"/><circle class="accent" cx="199" cy="69" r="14"/><circle class="secondary" cx="46" cy="45" r="12"/>
      <path class="shine" d="M103 55Q121 48 138 56"/><path class="accent" d="m182 145 5 12 13 4-13 5-5 12-4-12-13-5 13-4Z"/>
    </g>
    <g v-else-if="motif === 'toolkit'">
      <rect class="secondary" x="45" y="94" width="69" height="69" rx="18" transform="rotate(-12 79 128)"/><rect class="primary" x="107" y="79" width="87" height="87" rx="22" transform="rotate(9 150 122)"/>
      <path class="accent" d="M85 38a24 24 0 0 0 24 32l38 62a10 10 0 0 0 17-11l-39-61a24 24 0 0 0-17-30l6 20-18 8Z"/>
      <path class="shine" d="M124 96h35M57 108l20-4"/><circle class="accent" cx="191" cy="41" r="12"/><path class="face" d="M130 145q12 10 24 0"/>
    </g>
    <g v-else>
      <path class="primary" d="M122 28Q130 26 135 39l14 33 37 5Q201 80 190 93l-27 28 6 38Q170 175 154 168l-33-18-34 18Q72 175 75 158l7-37-27-28Q44 79 60 77l37-5 15-34Q116 28 122 28Z"/>
      <circle class="secondary" cx="49" cy="133" r="24"/><circle class="accent" cx="194" cy="47" r="18"/><circle class="secondary" cx="54" cy="42" r="9"/>
      <path class="shine" d="m117 48 5-8 11 29"/><circle class="ink" cx="108" cy="105" r="4"/><circle class="ink" cx="137" cy="105" r="4"/><path class="face" d="M112 119q11 12 22 0"/>
      <path class="accent" d="m195 132 4 10 11 4-11 4-4 11-4-11-11-4 11-4Z"/>
    </g>
  </svg>
</template>
<style scoped>
.admin-motif{width:240px;height:200px;max-width:100%;flex-shrink:0;overflow:visible}.compact{width:160px;height:134px}.primary{fill:var(--admin-glow-a,var(--admin-primary))}.secondary{fill:var(--admin-glow-b,var(--admin-primary))}.accent{fill:var(--admin-glow-c,var(--admin-primary))}.shadow{fill:var(--admin-text);opacity:.08}.stem{fill:var(--admin-glow-b);stroke:var(--admin-glow-b);stroke-width:7;stroke-linecap:round}.shine{fill:none;stroke:#fff;stroke-width:6;stroke-linecap:round;opacity:.6}.ink{fill:var(--admin-on-primary)}.face{fill:none;stroke:var(--admin-on-primary);stroke-width:3.5;stroke-linecap:round}.orbit{fill:none;stroke:var(--admin-glow-c);stroke-width:9}
</style>
