/**
 * Presentation policy for the bundled male-source atlas in the neutral education view.
 * This controls visibility, not an anatomical diagnosis or a claim of female anatomy.
 * Keep matches specific: corpus callosum, cavernous sinuses, pelvic bones and urinary
 * organs must remain available.
 */
export function isExcludedEducationalMesh(
  name: string,
  source: string,
): boolean {
  // GLTFLoader changes spaces to underscores and removes dots from .l/.r/.001 suffixes.
  const compact = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const dataset = source.toLowerCase().replace(/[^a-z]/g, "");

  // In these exact bundled source datasets this object is the complete male urethra,
  // including its external penile course. Do not remove every urinary-related mesh.
  if (
    ["organs", "visceral", "viscera"].includes(dataset) &&
    /^urethra(?:[lrj])?\d*$/.test(compact)
  )
    return true;

  return (
    /penis|penile|scrotum|scrotal|testis|testicular|epididymis|epididymal|ductusdeferens|vasdeferens|seminalgland|seminalvesicle|ejaculatoryduct|prostate|prostaticurethra|spongyurethra|bulbourethralgland|spermaticcord|cremaster|dartos|bulbospongiosus|ischiocavernosus/.test(
      compact,
    ) ||
    /pudendal|genitalbranchofgenitofemoralnerve|genitalsystems|reproductivesystem/.test(
      compact,
    ) ||
    /uterus|uterine|ovary|ovarian|fallopiantube|vagina|vaginal|clitoris|clitoral|labiamajora|labiaminora/.test(
      compact,
    )
  );
}
