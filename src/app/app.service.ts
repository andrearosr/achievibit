import * as colors from 'colors';
import { Injectable, Logger } from '@nestjs/common';

const logger = new Logger('Achievibit');

@Injectable()
export class AppService {
  root(): string {
    return 'Hello World!';
  }

  static printSplash(port?) {
    logger.log('');
    logger.log('');
    logger.log(cyan('                                                _            .          ..       .         s'));
    logger.log(cyan('                        .uef^"                 u            @88>  . uW8"        @88>      :8'));
    logger.log(cyan('                      :d88E                   88Nu.   u.    %8P   `t888         %8P      .88'));
    logger.log(cyan('      u           .   `888E            .u    \'88888.o888c    .     8888   .      .      :888ooo'));
    logger.log(cyan('   us888u.   .udR88N   888E .z8k    ud8888.   ^8888  8888  .@88u   9888.z88N   .@88u  -*8888888'));
    logger.log(cyan('.@88 "8888" <888\'888k  888E~?888L :888\'8888.   8888  8888 \'\'888E`  9888  888E \'\'888E`   8888'));
    logger.log(cyan('9888  9888  9888 \'Y"   888E  888E d888 \'88%"   8888  8888   888E   9888  888E   888E    8888'));
    logger.log(cyan('9888  9888  9888       888E  888E 8888.+"      8888  8888   888E   9888  888E   888E    8888'));
    logger.log(cyan('9888  9888  9888       888E  888E 8888L       .8888b.888P   888E   9888  888E   888E   .8888Lu='));
    logger.log(cyan('9888  9888  ?8888u../  888E  888E \'8888c. .+   ^Y8888*""    888&  .8888  888"   888&   ^%888*'));
    logger.log(cyan('"888*""888"  "8888P\'  m888N= 888>  "88888%       `Y"        R888"  `%888*%"     R888"    \'Y"'));
    logger.log(cyan(' ^Y"   ^Y\'     "P\'     `Y"   888     "YP\'                    ""       "`         ""'));
    logger.log(cyan('                            J88"'));
    logger.log(cyan('                            @%'));
    logger.log(cyan('                          :"'));
    logger.log('');
    logger.log(red('MIT license, 2015-2018'));
    logger.log(red('https://github.com/Kibibit/achevibit'));
    logger.log(port ? white(`Served on ${ colors.green('http://localhost:' + port) }`) : '');
    logger.log('');
  }
}

function cyan(text) {
  return colors.cyan(text);
}

function red(text) {
  return colors.red(text);
}

function white(text) {
  return colors.white(text);
}