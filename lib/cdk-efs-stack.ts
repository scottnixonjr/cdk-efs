import * as cdk from '@aws-cdk/core';
import * as efs from '@aws-cdk/aws-efs';
import * as ec2 from '@aws-cdk/aws-ec2';
import { SecurityGroup } from '@aws-cdk/aws-ec2';
import { EOF } from 'dns';

export class CdkEfsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'AcmeVPC');

    const subnetIds: string[] = [];
    vpc.privateSubnets.forEach((subnet, index) => {
      subnetIds.push(subnet.subnetId);
    });

    const mysg = new SecurityGroup(this, 'MySG', { vpc });

    mysg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(2049));

    const drive1 = new efs.CfnFileSystem(this, 'Drive1', { encrypted: true });
    const mountDrive1 = new efs.CfnMountTarget(this, 'Drive1Target', {
      fileSystemId: drive1.ref,
      securityGroups: [mysg.securityGroupId],
      subnetId: subnetIds[0],
    });

    const bastion = new ec2.BastionHostLinux(this, 'EFS-Bastion', { vpc });

    const user_data = `
    sudo yum install -y amazon-efs-utils

    export file_system_id_01=${mountDrive1.fileSystemId}
    export efs_directory=/mnt/efs
    sudo mkdir -p \${efs_directory}
    sudo sed -i "$ a \${file_system_id_01}:/ \${efs_directory} efs tls,_netdev" /etc/fstab
    # sudo mount -t efs -o tls \${file_system_id_01}:/ efs
    sudo mount -a -t efs defaults
    `;

    bastion.instance.addUserData(user_data);

    new cdk.CfnOutput(this, 'FileSystemId', {
      value: mountDrive1.fileSystemId,
    });
  }
}
