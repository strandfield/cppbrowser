<script setup>

defineProps({
  symbolKind: {
    type: String,
    required: true
  }
});

function getIconForSymbol(k) {
  if (k == 'class') {
    return "/symbol-class.svg";
  } else if (k == 'variable') {
    return "/symbol-variable.svg";
  }  else if (k == 'field') {
    return "/symbol-field.svg";
  } else if (k == 'function' || k == 'method' || k == 'static-method') {
    return "/symbol-method.svg";
  } else if (k == 'struct') {
    return "/symbol-structure.svg";
  } else if (k == 'enum') {
    return "/symbol-enum.svg";
  } else if (k == 'enum-constant') {
    return "/symbol-enum-member.svg";
  } else if (k == 'namespace' || k == 'inline-namespace' || k == 'namespace-alias') {
    return "/symbol-namespace.svg";
  } else if (k == 'operator') {
    return "/symbol-operator.svg";
  }
  return "/symbol-misc.svg";
}

</script>

<template>
  <img :src="getIconForSymbol(symbolKind)" class="symbol-icon" />
</template>

<style scoped>

</style>
