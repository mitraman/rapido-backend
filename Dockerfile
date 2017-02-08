# "ported" by Adam Miller <maxamillion@fedoraproject.org> from
#   https://github.com/fedora-cloud/Fedora-Dockerfiles
#
# Originally written for Fedora-Dockerfiles by
#   "Jason Clark" <jclark@redhat.com>

FROM centos:centos6
MAINTAINER The CentOS Project <cloud-ops@centos.org>

RUN yum -y update; yum clean all
RUN yum -y install epel-release; yum clean all
RUN yum -y install wget; yum clean all

# Install NodeJS 6.x repository
RUN curl -sL https://rpm.nodesource.com/setup_6.x | bash -

# Install NodeJS and npm
RUN yum -y install nodejs; yum clean all

ADD . /rapido

WORKDIR /rapido
RUN npm install

EXPOSE 8080

ENV 

CMD ["npm", "start"]
