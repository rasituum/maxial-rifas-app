#include <libheif/heif.h>
#include <stdio.h>
#include <stdlib.h>
/* Stop generation on codec failures without emitting test data. */
static void check(struct heif_error e) { if(e.code) { fprintf(stderr,"%s\n",e.message); exit(1); } }
/* Generate synthetic gradient HEICs; the last image is primary, with an alpha auxiliary image. */
int main(int argc,char**argv) {
  if(argc<3)return 1;
  check(heif_init(NULL));
  struct heif_context* ctx=heif_context_alloc();
  struct heif_encoder* enc=NULL;
  check(heif_context_get_encoder_for_format(ctx,heif_compression_HEVC,&enc));
  heif_encoder_set_lossy_quality(enc,80);
  heif_encoder_set_parameter_string(enc,"x265:pools","1");
  for(int image=0;image<atoi(argv[2]);image++) {
    struct heif_image *im=NULL;
    int channels=image?4:3;
    check(heif_image_create(64,32,heif_colorspace_RGB,image?heif_chroma_interleaved_RGBA:heif_chroma_interleaved_RGB,&im));
    check(heif_image_add_plane(im,heif_channel_interleaved,64,32,8));
    int stride;unsigned char*p=heif_image_get_plane(im,heif_channel_interleaved,&stride);
    for(int y=0;y<32;y++)for(int x=0;x<64;x++) {p[y*stride+x*channels]=image?20:230;p[y*stride+x*channels+1]=x*channels;p[y*stride+x*channels+2]=image?230:20;if(image)p[y*stride+x*channels+3]=128;}
    struct heif_image_handle* handle=NULL;
    struct heif_encoding_options *options=heif_encoding_options_alloc();
    if(argc>3)options->image_orientation=heif_orientation_rotate_90_cw;
    check(heif_context_encode_image(ctx,im,enc,options,&handle));
    heif_encoding_options_free(options);
    check(heif_context_set_primary_image(ctx,handle));
    heif_image_handle_release(handle);heif_image_release(im);
  }
  check(heif_context_write_to_file(ctx,argv[1]));
  heif_encoder_release(enc);heif_context_free(ctx);heif_deinit();return 0;
}
